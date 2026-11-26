use crate::{Session, types::*};
impl Session {
    pub(crate) fn legacy_apply_command(
        &mut self,
        owner: &str,
        command: Command,
    ) -> Result<(), String> {
        if !self.players.contains_key(owner) {
            return Err("player not found".into());
        }
        if matches!(
            command,
            Command::Pause { .. } | Command::Step { .. } | Command::Reset {}
        ) && self.mode != Mode::Training
        {
            return Err("debug commands require training session".into());
        }
        if self.result.is_some() && !matches!(command, Command::Reset {}) {
            return Err("session settled; reset training or create a new session".into());
        }
        let action_actor = match &command {
            Command::Move { actor_id, .. }
            | Command::Gather { actor_id }
            | Command::Deliver { actor_id }
            | Command::Attack {
                actor_id,
                target_id: None,
            }
            | Command::Capture { actor_id } => Some(actor_id.clone()),
            _ => None,
        };
        match command {
            Command::Attack {
                target_id: Some(_), ..
            }
            | Command::Repair { .. }
            | Command::Claim { .. }
            | Command::Cast { .. } => return Err("tactics require simulationVersion8".into()),
            Command::Run { .. } | Command::Jump { .. } | Command::Climb { .. } => {
                return Err("mobility requires simulationVersion7".into());
            }
            Command::Task { .. } => return Err("tasks require simulation v3".into()),
            Command::Equip {
                actor_id,
                appearance,
            } => {
                let (entity, mut actor) = self.owned_actor(owner, &actor_id)?;
                if actor.appearance.weapon != appearance.weapon
                    && self.tactical_block(&actor_id) == Some("actor-casting")
                {
                    return Err("weapon locked during cast".into());
                }
                actor.appearance = appearance;
                self.world.entity_mut(entity).insert(actor);
                self.event("equip", format!("{actor_id} 更新了装束"), Some(owner));
            }
            Command::Pause { paused } => self.paused = paused,
            Command::Step { ticks } => {
                self.validate_step(ticks)?;
                for _ in 0..ticks {
                    self.advance_unrecorded();
                }
            }
            Command::Reset {} => {
                let tokens = self.tokens.clone();
                let scripts = std::mem::take(&mut self.scripts);
                let script_versions = std::mem::take(&mut self.script_versions);
                let metadata: Vec<_> = self
                    .players
                    .iter()
                    .map(|(id, player)| (id.clone(), player.script.clone()))
                    .collect();
                let operations = std::mem::take(&mut self.replay_operations);
                let overflowed = self.replay_overflowed;
                let simulation_version = self.simulation_version;
                *self = if let Some(scenario) = self.scenario_id {
                    Self::new_scenario(self.id.clone(), self.mode, self.seed, scenario)
                } else {
                    Self::new(self.id.clone(), self.mode, self.seed)
                };
                self.configure_replay_version(simulation_version);
                for token in tokens.keys() {
                    self.join(token.clone())?;
                }
                self.replay_operations = operations;
                self.replay_overflowed = overflowed;
                self.scripts = scripts;
                self.script_versions = script_versions;
                for (id, script) in metadata {
                    self.players.get_mut(&id).unwrap().script = script;
                }
                self.paused = true;
            }
            Command::Rule {
                preset, retreat_hp, ..
            } => {
                if !["gather", "defend", "explore"].contains(&preset.as_str()) || retreat_hp > 100 {
                    return Err("invalid preset or retreatHp (0..100)".into());
                }
                self.players.get_mut(owner).unwrap().rule = Rule { preset, retreat_hp };
                self.players.get_mut(owner).unwrap().script = None;
                self.scripts.remove(owner);
                self.event("rule", "行动规则已发布".into(), Some(owner));
            }
            Command::Move { actor_id, room_id } => {
                let (entity, mut actor) = self.actor(owner, &actor_id)?;
                let target = self.room_index(&room_id)?;
                let from = self.room_index(&actor.room_id)?;
                let a = &self.rooms[from];
                let b = &self.rooms[target];
                let distance =
                    ((a.q - b.q).abs() + (a.r - b.r).abs() + ((a.q + a.r) - (b.q + b.r)).abs()) / 2;
                if distance > 1 {
                    return Err("target must be an adjacent room".into());
                }
                actor.room_id = room_id;
                actor.state = "moving".into();
                self.world.entity_mut(entity).insert(actor);
                self.event(
                    "move",
                    format!("{actor_id} 前往 {}", self.rooms[target].name),
                    Some(owner),
                );
            }
            Command::Gather { actor_id } => {
                let (e, a) = self.actor(owner, &actor_id)?;
                self.gather(e, a)?;
            }
            Command::Deliver { actor_id } => {
                let (e, a) = self.actor(owner, &actor_id)?;
                self.deliver(e, a)?;
            }
            Command::Attack {
                actor_id,
                target_id: None,
            } => {
                let (e, a) = self.actor(owner, &actor_id)?;
                self.attack(e, a)?;
            }
            Command::Capture { actor_id } => {
                let (_, a) = self.actor(owner, &actor_id)?;
                self.capture(&a)?;
            }
            Command::Build { room_id, kind } => {
                if !["tower", "catalog"].contains(&kind.as_str()) {
                    return Err("invalid building kind".into());
                }
                let idx = self.room_index(&room_id)?;
                if self.rooms[idx].enemy_hp > 0 {
                    return Err("clear hostiles before building".into());
                }
                let present = self
                    .world
                    .query::<&Actor>()
                    .iter(&self.world)
                    .any(|a| a.owner == owner && a.room_id == room_id && a.hp > 0);
                if !present {
                    return Err("owned actor must be in room".into());
                }
                if self
                    .buildings
                    .iter()
                    .any(|b| b.room_id == room_id && b.kind == kind)
                {
                    return Err("building already exists".into());
                }
                let p = self.players.get_mut(owner).unwrap();
                if p.materials < 25 {
                    return Err("need 25 materials".into());
                }
                p.materials -= 25;
                self.buildings.push(Building {
                    world_position: Default::default(),
                    hp: 0,
                    max_hp: 0,
                    construction_ticks: 0,
                    required_ticks: 0,
                    id: format!("building-{}", self.buildings.len() + 1),
                    owner: owner.into(),
                    room_id,
                    kind,
                });
                self.event("build", "消耗 25 建材，建筑完工".into(), Some(owner));
            }
        }
        if let Some(actor_id) = action_actor {
            self.manual_actions.insert(actor_id, self.tick);
        }
        Ok(())
    }
}
