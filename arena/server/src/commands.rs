use crate::{ReplayOperation, Session, types::*};
use bevy_ecs::prelude::Entity;
impl Session {
    pub(crate) fn owned_actor(&mut self, owner: &str, id: &str) -> Result<(Entity, Actor), String> {
        let (e, a) = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .find(|(_, a)| a.id == id)
            .map(|(e, a)| (e, a.clone()))
            .ok_or("actor not found")?;
        if a.owner != owner {
            return Err("actor ownership denied".into());
        }
        Ok((e, a))
    }
    pub(crate) fn actor(&mut self, owner: &str, id: &str) -> Result<(Entity, Actor), String> {
        let (e, a) = self.owned_actor(owner, id)?;
        if a.hp == 0 {
            return Err("actor downed".into());
        }
        if a.travel.is_some() {
            return Err("actor travelling; interactions require arrival".into());
        }
        if self.manual_actions.get(id) == Some(&self.tick) {
            return Err("actor already acted this tick".into());
        }
        Ok((e, a))
    }
    pub(crate) fn room_index(&self, id: &str) -> Result<usize, String> {
        self.rooms
            .iter()
            .position(|r| r.id == id)
            .ok_or("room not found".into())
    }
    pub fn command(&mut self, owner: &str, command: Command) -> Result<(), String> {
        if self.simulation_version >= 3
            && self.players.get(owner).is_some_and(|p| p.script.is_some())
            && matches!(
                command,
                Command::Task { .. }
                    | Command::Run { .. }
                    | Command::Jump { .. }
                    | Command::Climb { .. }
                    | Command::Move { .. }
                    | Command::Gather { .. }
                    | Command::Deliver { .. }
                    | Command::Attack { .. }
                    | Command::Repair { .. }
                    | Command::Claim { .. }
                    | Command::Capture { .. }
                    | Command::Build { .. }
            )
        {
            return Err("TypeScript驱动小队，请先停用脚本再下达手动任务".into());
        }
        let recorded = command.clone();
        self.apply_command(owner, command)?;
        self.record_operation(ReplayOperation::Command {
            player_id: owner.into(),
            command: recorded,
        });
        Ok(())
    }
    pub(crate) fn apply_command(&mut self, owner: &str, command: Command) -> Result<(), String> {
        if self.simulation_version < 8
            && matches!(
                &command,
                Command::Attack {
                    target_id: Some(_),
                    ..
                } | Command::Repair { .. }
                    | Command::Claim { .. }
            )
        {
            return Err("tactics require simulationVersion8".into());
        }
        if self.simulation_version < 3 {
            return self.legacy_apply_command(owner, command);
        }
        if !self.players.contains_key(owner) {
            return Err("player not found".into());
        }
        if self.result.is_some() && !matches!(command, Command::Reset {}) {
            return Err("session settled; reset to retry same seed".into());
        }
        let clear_target = if self.simulation_version >= 8 {
            match &command {
                Command::Move { actor_id, .. }
                | Command::Run { actor_id, .. }
                | Command::Jump { actor_id, .. }
                | Command::Climb { actor_id, .. }
                | Command::Task { actor_id, .. }
                | Command::Capture { actor_id }
                | Command::Gather { actor_id }
                | Command::Deliver { actor_id }
                | Command::Attack {
                    actor_id,
                    target_id: None,
                } => Some(actor_id.clone()),
                _ => None,
            }
        } else {
            None
        };
        let jump_command = matches!(&command, Command::Jump { .. });
        match command {
            Command::Task {
                actor_id,
                kind,
                target,
                building_kind,
            } => {
                self.room_index(&target)?;
                if !["gather", "build", "guard", "return"].contains(&kind.as_str()) {
                    return Err("invalid task kind".into());
                }
                if kind == "build"
                    && !matches!(
                        building_kind.as_deref(),
                        Some("warehouse" | "tower" | "catalog")
                    )
                {
                    return Err("buildingKind required: warehouse, tower or catalog".into());
                }
                let (e, mut a) = self.owned_actor(owner, &actor_id)?;
                if a.hp == 0 {
                    return Err("actor downed".into());
                }
                if let Some(t) = &a.travel {
                    if a.task.as_ref().is_some_and(|task| {
                        task.kind == kind
                            && task.target == target
                            && task.building_kind == building_kind
                    }) {
                        return Ok(());
                    }
                    return Err(format!(
                        "travel in progress to {}; assign task after arrival",
                        t.target_room_id
                    ));
                }
                crate::action_runtime::assign_task(
                    &mut a.task,
                    ActorTask {
                        kind,
                        target,
                        stage: "queued".into(),
                        stage_started_tick: 0,
                        blocked_reason: None,
                        building_kind,
                    },
                    self.tick,
                    self.simulation_version,
                );
                self.world.entity_mut(e).insert(a);
            }
            Command::Run {
                actor_id,
                via_room_id,
                room_id,
            } => {
                if self.simulation_version < 7 {
                    return Err("run requires simulationVersion7".into());
                }
                let (e, mut a) = self.actor(owner, &actor_id)?;
                crate::mobility::run(&mut a, &via_room_id, &room_id, self.tick)?;
                a.task = None;
                self.world.entity_mut(e).insert(a);
            }
            Command::Jump { actor_id, edge_id } | Command::Climb { actor_id, edge_id } => {
                if self.simulation_version < 7 {
                    return Err("mobility edge requires simulationVersion7".into());
                }
                let kind = if jump_command {
                    crate::TravelKind::Jump
                } else {
                    crate::TravelKind::Climb
                };
                let (e, mut a) = self.actor(owner, &actor_id)?;
                crate::mobility::edge(&mut a, &edge_id, kind, self.tick)?;
                a.task = None;
                self.world.entity_mut(e).insert(a);
            }
            Command::Move { actor_id, room_id } => {
                self.room_index(&room_id)?;
                let (e, mut a) = self.owned_actor(owner, &actor_id)?;
                crate::travel::start_for_version(
                    &mut a,
                    &room_id,
                    self.tick,
                    self.simulation_version,
                )?;
                a.task = None;
                self.world.entity_mut(e).insert(a);
            }
            Command::Gather { actor_id } => {
                let (e, mut a) = self.actor(owner, &actor_id)?;
                if self.tick < a.action_tick + crate::scenario::number("gatherIntervalTicks") {
                    return Err("gather cooldown".into());
                }
                self.gather_playable(&mut a)?;
                self.world.entity_mut(e).insert(a);
            }
            Command::Deliver { actor_id } => {
                let (e, mut a) = self.actor(owner, &actor_id)?;
                if a.cargo == 0
                    || a.travel.is_some()
                    || self.deposit_anchor(owner, &a.room_id).is_none()
                {
                    return Err("delivery requires cargo after arrival".into());
                }
                a.pending_delivery = true;
                self.world.entity_mut(e).insert(a);
            }
            Command::Attack {
                actor_id,
                target_id: Some(target_id),
            } => {
                self.targeted_attack(owner, &actor_id, &target_id)?;
            }
            Command::Repair {
                actor_id,
                building_id,
            } => {
                self.repair_building(owner, &actor_id, &building_id)?;
            }
            Command::Claim { actor_id, room_id } => {
                self.claim_point(owner, &actor_id, &room_id)?;
            }
            Command::Attack {
                actor_id,
                target_id: None,
            } => {
                let (e, mut a) = self.actor(owner, &actor_id)?;
                self.actor_attack(&mut a)?;
                if self.simulation_version >= 8 {
                    self.manual_actions.insert(actor_id, self.tick);
                }
                self.world.entity_mut(e).insert(a);
            }
            Command::Capture { actor_id } => {
                let (e, mut a) = self.actor(owner, &actor_id)?;
                crate::action_runtime::assign_task(
                    &mut a.task,
                    ActorTask {
                        kind: "guard".into(),
                        target: a.room_id.clone(),
                        stage: "guarding".into(),
                        stage_started_tick: 0,
                        blocked_reason: None,
                        building_kind: None,
                    },
                    self.tick,
                    self.simulation_version,
                );
                self.world.entity_mut(e).insert(a);
            }
            Command::Build { room_id, kind } => {
                let mut candidates: Vec<_> = self
                    .world
                    .query::<(Entity, &Actor)>()
                    .iter(&self.world)
                    .filter(|(_, a)| {
                        a.owner == owner && a.room_id == room_id && a.hp > 0 && a.travel.is_none()
                    })
                    .map(|(e, a)| (e, a.clone()))
                    .collect();
                candidates.sort_by(|a, b| a.1.id.cmp(&b.1.id));
                let (e, mut a) = candidates
                    .into_iter()
                    .next()
                    .ok_or("builder must be present, alive and stationary")?;
                self.ensure_site(owner, &room_id, &kind)?;
                let stage = crate::action_runtime::build_stage(&a, &kind, self.simulation_version);
                crate::action_runtime::assign_task(
                    &mut a.task,
                    ActorTask {
                        kind: "build".into(),
                        target: room_id,
                        stage,
                        stage_started_tick: 0,
                        blocked_reason: None,
                        building_kind: Some(kind),
                    },
                    self.tick,
                    self.simulation_version,
                );
                self.world.entity_mut(e).insert(a);
            }
            Command::Rule {
                preset,
                retreat_hp,
                assign_tasks,
            } => {
                if !["gather", "defend", "explore"].contains(&preset.as_str()) || retreat_hp > 100 {
                    return Err("invalid preset or retreatHp (0..100)".into());
                }
                self.players.get_mut(owner).unwrap().rule = Rule { preset, retreat_hp };
                if assign_tasks {
                    self.players.get_mut(owner).unwrap().script = None;
                    self.scripts.remove(owner);
                    self.apply_preset(owner);
                    self.event("rule", "预设已发布为实际岗位任务".into(), Some(owner));
                }
            }
            other => self.legacy_apply_command(owner, other)?,
        }
        if let Some(id) = clear_target {
            self.tactics
                .as_mut()
                .unwrap()
                .actor_states
                .get_mut(&id)
                .unwrap()
                .attack_target_id = None;
        }
        Ok(())
    }
}
