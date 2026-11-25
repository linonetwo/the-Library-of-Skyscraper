use crate::{Actor, ReplayOperation, Session};
use bevy_ecs::prelude::Entity;
impl Session {
    pub fn advance(&mut self) {
        if self.result.is_none() {
            self.advance_unrecorded();
            self.record_operation(ReplayOperation::Advance {});
        }
    }
    pub(crate) fn advance_unrecorded(&mut self) {
        if self.simulation_version < 3 {
            self.legacy_advance_unrecorded();
            return;
        }
        if self.result.is_some() {
            return;
        }
        self.tick += 1;
        let mut actors: Vec<_> = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .map(|(e, a)| (e, a.clone()))
            .collect();
        actors.sort_by(|a, b| a.1.id.cmp(&b.1.id));
        let previous_tasks = actors.iter().map(|(e, a)| (*e, a.task.clone())).collect();
        for (e, mut a) in actors {
            if self.simulation_version >= 7 && a.hp > 0 && a.travel.is_none() {
                a.locomotion = None;
                a.world_height_milli = Some(0);
            }
            if self.simulation_version >= 5
                && let Some(t) = &a.travel
            {
                let targets: Vec<_> = self
                    .enemies
                    .iter()
                    .filter(|e| e.hp > 0 && e.travel.is_none() && e.room_id == t.target_room_id)
                    .map(|e| e.world_position)
                    .collect();
                crate::combat_approach::stop_before_opponent(&mut a.travel, &targets);
            }
            if a.hp > 0 && crate::travel::advance(&mut a, self.simulation_version) {
                a.last_moved_tick = self.tick;
            }
            self.task_tick(&mut a);
            self.world.entity_mut(e).insert(a);
        }
        // Enemy travel consumes exactly the same fixed-point path integrator.
        let defenders: Vec<_> = self
            .world
            .query::<&Actor>()
            .iter(&self.world)
            .filter(|a| a.hp > 0 && a.travel.is_none())
            .map(|a| (a.room_id.clone(), a.world_position))
            .collect();
        for enemy in &mut self.enemies {
            if self.simulation_version >= 5
                && let Some(t) = &enemy.travel
            {
                let targets: Vec<_> = defenders
                    .iter()
                    .filter(|(room, _)| *room == t.target_room_id)
                    .map(|(_, p)| *p)
                    .collect();
                crate::combat_approach::stop_before_opponent(&mut enemy.travel, &targets);
            }
            if enemy.hp > 0 && enemy.travel.is_some() {
                enemy.last_moved_tick = self.tick;
            }
            if enemy.hp > 0 {
                let (arrived, motion) =
                    crate::travel::advance_motion(&mut enemy.world_position, &mut enemy.travel);
                motion.record(
                    self.simulation_version,
                    &mut enemy.motion_distance_milli,
                    &mut enemy.last_move_direction,
                );
                if let Some(room) = arrived {
                    enemy.room_id = room;
                    enemy.state = "guarding".into();
                }
            }
        }
        self.combat_tick();
        self.construction_tick();
        self.scenario_tick();
        self.commit_task_stages(previous_tasks);
    }
}
