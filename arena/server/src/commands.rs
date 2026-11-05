use crate::{ReplayOperation, Session, types::*};
use bevy_ecs::prelude::Entity;

impl Session {
    fn owned_actor(&mut self, owner: &str, id: &str) -> Result<(Entity, Actor), String> {
        let (entity, actor) = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .find(|(_, a)| a.id == id)
            .map(|(e, a)| (e, a.clone()))
            .ok_or("actor not found")?;
        if actor.owner != owner {
            return Err("actor ownership denied".into());
        }
        Ok((entity, actor))
    }
    pub(crate) fn actor(&mut self, owner: &str, id: &str) -> Result<(Entity, Actor), String> {
        let (entity, actor) = self.owned_actor(owner, id)?;
        if actor.hp == 0 {
            return Err("actor downed".into());
        }
        if self.manual_actions.get(id) == Some(&self.tick) {
            return Err("actor already acted this tick".into());
        }
        Ok((entity, actor))
    }
    pub(crate) fn room_index(&self, id: &str) -> Result<usize, String> {
        self.rooms
            .iter()
            .position(|r| r.id == id)
            .ok_or("room not found".into())
    }
    pub fn command(&mut self, owner: &str, command: Command) -> Result<(), String> {
        // Record only accepted operations. Internal Step ticks and Reset joins
        // deliberately use unrecorded paths to avoid replaying them twice.
        let recorded = command.clone();
        self.apply_command(owner, command)?;
        self.record_operation(ReplayOperation::Command {
            player_id: owner.into(),
            command: recorded,
        });
        Ok(())
    }
    pub(crate) fn apply_command(&mut self, owner: &str, command: Command) -> Result<(), String> {
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
            | Command::Attack { actor_id }
            | Command::Capture { actor_id } => Some(actor_id.clone()),
            _ => None,
        };
        match command {
            Command::Equip {
                actor_id,
                appearance,
            } => {
                let (entity, mut actor) = self.owned_actor(owner, &actor_id)?;
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
                let metadata: Vec<_> = self
                    .players
                    .iter()
                    .map(|(id, player)| (id.clone(), player.script.clone()))
                    .collect();
                let operations = std::mem::take(&mut self.replay_operations);
                let overflowed = self.replay_overflowed;
                *self = Self::new(self.id.clone(), self.mode, self.seed);
                for token in tokens.keys() {
                    self.join(token.clone())?;
                }
                self.replay_operations = operations;
                self.replay_overflowed = overflowed;
                self.scripts = scripts;
                for (id, script) in metadata {
                    self.players.get_mut(&id).unwrap().script = script;
                }
                self.paused = true;
            }
            Command::Rule { preset, retreat_hp } => {
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
            Command::Attack { actor_id } => {
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
