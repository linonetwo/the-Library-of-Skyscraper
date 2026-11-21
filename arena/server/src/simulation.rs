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
        for (e, mut a) in actors {
            if a.hp > 0 && crate::travel::advance(&mut a) {
                a.last_moved_tick = self.tick;
            }
            self.task_tick(&mut a);
            self.world.entity_mut(e).insert(a);
        }
        // Enemy travel consumes exactly the same fixed-point path integrator.
        for enemy in &mut self.enemies {
            if enemy.hp > 0 && enemy.travel.is_some() {
                enemy.last_moved_tick = self.tick;
            }
            if enemy.hp > 0
                && let Some(room) =
                    crate::travel::advance_motion(&mut enemy.world_position, &mut enemy.travel)
            {
                enemy.room_id = room;
                enemy.state = "guarding".into();
            }
        }
        self.combat_tick();
        self.construction_tick();
        self.scenario_tick();
    }
}
