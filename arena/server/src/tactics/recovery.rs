use super::scenario::number;
use crate::{Actor, Session, TacticalAction, TacticalEvent, TacticalPhase};
use bevy_ecs::prelude::Entity;

impl Session {
    pub(crate) fn tactical_phase_tick(&mut self) {
        let actors: Vec<_> = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .map(|(e, a)| (e, a.clone()))
            .collect();
        for (entity, mut actor) in actors {
            let state = self
                .tactics
                .as_mut()
                .unwrap()
                .actor_states
                .get_mut(&actor.id)
                .unwrap();
            let interval = number("inkStrike", "regenerationTicks");
            let elapsed = (self.tick - state.last_energy_tick) / interval;
            if actor.hp > 0 && elapsed > 0 {
                state.energy =
                    (state.energy + elapsed as u32).min(number("inkStrike", "maxEnergy") as u32);
                state.last_energy_tick += elapsed * interval;
            }
            let cast_done = state
                .cast
                .as_ref()
                .is_some_and(|c| self.tick >= c.ends_tick);
            let completed_cast = if cast_done { state.cast.take() } else { None };
            let recovery_done = state
                .recovery
                .as_ref()
                .is_some_and(|r| self.tick >= r.ends_tick);
            let rising = state
                .recovery
                .as_ref()
                .is_some_and(|r| self.tick == r.rising_tick);
            if recovery_done {
                state.recovery = None;
            }
            let phase = if let Some(r) = &state.recovery {
                Some(if self.tick < r.rising_tick {
                    "downed"
                } else {
                    "rising"
                })
            } else {
                state.cast.as_ref().map(|c| {
                    if self.tick < c.release_tick {
                        "casting"
                    } else {
                        "cast-recovery"
                    }
                })
            };
            if actor.hp > 0 {
                if let Some(phase) = phase {
                    actor.state = phase.into();
                } else if recovery_done || cast_done {
                    actor.state = "idle".into();
                }
            }
            self.world.entity_mut(entity).insert(actor.clone());
            if let Some(cast) = completed_cast {
                self.tactical_event(
                    TacticalEvent {
                        action: TacticalAction::Cast,
                        actor_id: actor.id.clone(),
                        target_id: cast.target_id,
                        phase: TacticalPhase::Completed,
                        reason_code: None,
                        values: Default::default(),
                    },
                    Some(&actor.owner),
                );
            }
            if actor.hp > 0 && (rising || recovery_done) {
                self.tactical_event(
                    TacticalEvent {
                        action: TacticalAction::Recovery,
                        actor_id: actor.id.clone(),
                        target_id: actor.id.clone(),
                        phase: if recovery_done {
                            TacticalPhase::Completed
                        } else {
                            TacticalPhase::Rising
                        },
                        reason_code: None,
                        values: Default::default(),
                    },
                    Some(&actor.owner),
                );
            }
        }
    }
    pub(crate) fn tactical_block(&self, actor_id: &str) -> Option<&'static str> {
        let state = self.tactics.as_ref()?.actor_states.get(actor_id)?;
        if state
            .recovery
            .as_ref()
            .is_some_and(|r| self.tick < r.ends_tick)
        {
            Some("actor-recovering")
        } else if state.cast.as_ref().is_some_and(|c| self.tick < c.ends_tick) {
            Some("actor-casting")
        } else {
            None
        }
    }
}
