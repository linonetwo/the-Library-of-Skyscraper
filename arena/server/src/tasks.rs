use crate::{Actor, Session};
impl Session {
    pub(crate) fn apply_preset(&mut self, owner: &str) {
        if self.simulation_version < 3 || self.players[owner].script.is_some() {
            return;
        }
        let preset = self.players[owner].rule.preset.clone();
        let template = &crate::scenario::config()["presetTasks"][&preset];
        let entities: Vec<_> = self
            .world
            .query::<(bevy_ecs::prelude::Entity, &Actor)>()
            .iter(&self.world)
            .filter(|(_, a)| a.owner == owner && a.hp > 0)
            .map(|(e, a)| (e, a.role.clone()))
            .collect();
        for (e, role) in entities {
            let t = &template[role];
            let mut a = self.world.get_mut::<Actor>(e).unwrap();
            crate::action_runtime::assign_task(
                &mut a.task,
                crate::ActorTask {
                    kind: t["kind"].as_str().unwrap().into(),
                    target: t["target"].as_str().unwrap().into(),
                    building_kind: t["buildingKind"].as_str().map(str::to_owned),
                    stage: "queued".into(),
                    stage_started_tick: 0,
                    blocked_reason: None,
                },
                self.tick,
                self.simulation_version,
            );
        }
    }
    pub(crate) fn deposit_anchor(&self, owner: &str, room: &str) -> Option<crate::Position> {
        self.buildings
            .iter()
            .find(|b| {
                b.owner == owner
                    && b.room_id == room
                    && b.kind == "warehouse"
                    && b.hp > 0
                    && b.construction_ticks >= b.required_ticks
            })
            .map(|b| b.world_position)
    }

    pub(crate) fn deposit(&mut self, a: &mut Actor) -> Result<(), String> {
        if a.travel.is_some() || a.cargo == 0 || !self.deposit_room(&a.owner, &a.room_id) {
            return Err("deposit requires cargo at a completed owned warehouse".into());
        }
        let anchor = self
            .deposit_anchor(&a.owner, &a.room_id)
            .ok_or("no completed warehouse")?;
        if crate::travel::distance(a.world_position, anchor) > 1500 {
            return Err("approach warehouse within 1.5 tiles before depositing".into());
        }
        let amount = a.cargo;
        self.players.get_mut(&a.owner).unwrap().materials += amount;
        self.scenario.report.materials_delivered += amount;
        a.cargo = 0;
        a.state = "delivering".into();
        crate::action_runtime::action(
            &mut a.action_cue,
            crate::ActionCue::new("deliver", self.tick, 2, Some(anchor)).unwrap(),
            self.simulation_version,
        );
        self.event(
            "deliver",
            format!("{} 入库 {amount} 建材", a.id),
            Some(&a.owner),
        );
        Ok(())
    }
    fn delivery_tick(&mut self, a: &mut Actor) -> bool {
        let Some(anchor) = self.deposit_anchor(&a.owner, &a.room_id) else {
            return false;
        };
        crate::travel::approach_actor(a, anchor, 750, self.tick, self.simulation_version);
        if self.deposit(a).is_ok() {
            a.pending_delivery = false;
        }
        true
    }
    fn deposit_room(&self, owner: &str, room: &str) -> bool {
        room == "room-0"
            || self.buildings.iter().any(|b| {
                b.owner == owner
                    && b.room_id == room
                    && b.kind == "warehouse"
                    && b.hp > 0
                    && b.construction_ticks >= b.required_ticks
            })
    }
    pub(crate) fn gather_playable(&mut self, a: &mut Actor) -> Result<(), String> {
        if a.travel.is_some() {
            return Err("gather requires arrival".into());
        }
        let idx = self.room_index(&a.room_id)?;
        let n = self.rooms[idx]
            .resources
            .min(a.cargo_capacity.saturating_sub(a.cargo))
            .min(crate::scenario::number("gatherAmount") as u32);
        if n == 0 {
            return Err("资源耗尽或背包已满".into());
        }
        self.rooms[idx].resources -= n;
        a.cargo += n;
        a.action_tick = self.tick;
        a.state = "gathering".into();
        crate::action_runtime::action(
            &mut a.action_cue,
            crate::ActionCue::new(
                "gather",
                self.tick,
                4,
                Some(crate::travel::center(&a.room_id)),
            )
            .unwrap(),
            self.simulation_version,
        );
        self.event(
            "gather",
            format!(
                "{} 采集 {n} 建材入袋 ({}/{})",
                a.id, a.cargo, a.cargo_capacity
            ),
            Some(&a.owner),
        );
        Ok(())
    }
    pub(crate) fn task_tick(&mut self, a: &mut Actor) {
        if a.hp == 0 {
            a.travel = None;
            a.state = "downed".into();
            if let Some(t) = &mut a.task {
                crate::action_runtime::set_stage(t, "failed", self.tick, self.simulation_version);
                t.blocked_reason = Some("队员已倒地".into());
            }
            return;
        }
        let threshold = self.players[&a.owner].rule.retreat_hp;
        if a.hp * 100 <= a.max_hp * threshold {
            a.retreating = true;
        }
        if a.retreating {
            a.state = "retreating".into();
            if let Some(t) = &mut a.task {
                crate::action_runtime::set_stage(
                    t,
                    "retreating",
                    self.tick,
                    self.simulation_version,
                );
                t.blocked_reason = Some("生命过低，正返回据点恢复".into());
            }
            if a.travel.is_some() {
                return;
            }
            if a.room_id != "room-0" {
                let _ = crate::travel::start(a, "room-0", self.tick);
                a.state = "retreating".into();
                return;
            }
            if self
                .tick
                .is_multiple_of(crate::scenario::number("healIntervalTicks"))
            {
                a.hp = (a.hp + crate::scenario::number("healAmount") as u32).min(a.max_hp);
            }
            a.state = "recovering".into();
            if a.hp >= crate::scenario::number("recoverHp") as u32 {
                a.retreating = false;
            }
            return;
        }
        if a.travel.is_some() {
            if let Some(t) = &mut a.task {
                crate::action_runtime::set_stage(
                    t,
                    "travelling",
                    self.tick,
                    self.simulation_version,
                );
            }
            return;
        }
        if a.pending_delivery && a.cargo > 0 && self.delivery_tick(a) {
            return;
        }
        let Some(mut task) = a.task.clone() else {
            a.state = "idle".into();
            return;
        };
        task.blocked_reason = None;
        let mut destination = task.target.clone();
        if task.kind == "return" {
            destination = "room-0".into();
        }
        if task.kind == "gather"
            && (a.cargo >= a.cargo_capacity
                || (a.cargo > 0
                    && self.rooms[self.room_index(&task.target).unwrap()].resources == 0))
        {
            destination = self
                .buildings
                .iter()
                .filter(|b| {
                    b.owner == a.owner
                        && b.kind == "warehouse"
                        && b.hp > 0
                        && b.construction_ticks >= b.required_ticks
                })
                .map(|b| b.room_id.clone())
                .chain(std::iter::once("room-0".into()))
                .min_by_key(|id| {
                    crate::travel::distance(a.world_position, crate::travel::center(id))
                })
                .unwrap();
            task.stage = "transporting".into();
        }
        if a.cargo > 0 && self.deposit_anchor(&a.owner, &a.room_id).is_some() {
            a.pending_delivery = true;
            self.delivery_tick(a);
            if a.pending_delivery {
                task.stage = "depositing".into();
                crate::action_runtime::commit_stage(
                    &a.task,
                    &mut task,
                    self.tick,
                    self.simulation_version,
                );
                a.task = Some(task);
                return;
            }
        }
        if a.room_id != destination {
            let _ = crate::travel::start(a, &destination, self.tick);
            task.stage = if destination != task.target {
                "transporting"
            } else {
                "travelling"
            }
            .into();
            crate::action_runtime::commit_stage(
                &a.task,
                &mut task,
                self.tick,
                self.simulation_version,
            );
            a.task = Some(task);
            return;
        }
        match task.kind.as_str() {
            "gather" => {
                task.stage = "gathering".into();
                let unavailable = self.simulation_version >= 4
                    && self.rooms[self.room_index(&a.room_id).unwrap()].resources == 0;
                if (unavailable
                    || self.tick >= a.action_tick + crate::scenario::number("gatherIntervalTicks"))
                    && let Err(e) = self.gather_playable(a)
                {
                    task.blocked_reason = Some(e);
                    task.stage = "blocked".into();
                }
            }
            "build" => {
                let kind = task.building_kind.as_deref().unwrap_or("catalog");
                crate::travel::approach_actor(
                    a,
                    crate::travel::build_anchor(&a.room_id, kind),
                    750,
                    self.tick,
                    self.simulation_version,
                );
                if self.buildings.iter().any(|b| {
                    b.owner == a.owner
                        && b.room_id == a.room_id
                        && b.kind == kind
                        && b.hp > 0
                        && b.construction_ticks >= b.required_ticks
                }) {
                    task.stage = "completed".into();
                    a.state = "guarding".into();
                } else {
                    task.stage = "construction".into();
                    if let Err(e) = self.ensure_site(&a.owner, &a.room_id, kind) {
                        task.stage = "blocked".into();
                        task.blocked_reason = Some(e);
                    }
                    if self.simulation_version >= 4
                        && task.stage == "construction"
                        && crate::travel::distance(
                            a.world_position,
                            crate::travel::build_anchor(&a.room_id, kind),
                        ) > 2000
                    {
                        task.stage = "approaching".into();
                    }
                    a.state = "building".into();
                }
            }
            "guard" => {
                task.stage = "guarding".into();
                a.state = "guarding".into();
            }
            "return" => {
                task.stage = "completed".into();
                a.state = "idle".into();
            }
            _ => {}
        }
        crate::action_runtime::commit_stage(&a.task, &mut task, self.tick, self.simulation_version);
        a.task = Some(task);
    }
}
