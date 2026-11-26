use super::scenario::number;
use crate::{
    Actor, HeavyAttack, ScenarioId, Session, TacticalAction, TacticalEvent, TacticalPhase,
};
use bevy_ecs::prelude::Entity;

impl Session {
    /// One saved telegraph target, resolved after travel; ordinary attacks share
    /// the same enemy action_tick and cannot also hit during this window.
    pub(crate) fn heavy_tick(&mut self) {
        if self.scenario_id != Some(ScenarioId::SealContest) {
            return;
        }
        for i in 0..self.enemies.len() {
            let id = self.enemies[i].id.clone();
            let state = self
                .tactics
                .as_mut()
                .unwrap()
                .heavy_attacks
                .entry(id.clone())
                .or_default();
            let pending = if state
                .pending
                .as_ref()
                .is_some_and(|p| p.release_tick <= self.tick)
            {
                state.pending.take()
            } else {
                None
            };
            if let Some(pending) = pending {
                self.enemies[i].action_tick = self.tick;
                let target = self
                    .world
                    .query::<(Entity, &Actor)>()
                    .iter(&self.world)
                    .find(|(_, a)| a.id == pending.actor_id)
                    .map(|(e, a)| (e, a.clone()));
                if let Some((entity, mut actor)) = target {
                    let in_range = actor.hp > 0
                        && actor.travel.is_none()
                        && actor.world_height_milli.unwrap_or(0) == 0
                        && actor.room_id == self.enemies[i].room_id
                        && crate::travel::distance(
                            actor.world_position,
                            self.enemies[i].world_position,
                        ) <= crate::scenario::number("attackRange") * 1000;
                    if self.enemies[i].hp > 0 && in_range {
                        let position = self.enemies[i].world_position;
                        self.enemies[i].action_cue = crate::ActionCue::new(
                            "attack",
                            self.tick,
                            2,
                            Some(actor.world_position),
                        );
                        self.hit_actor(
                            &mut actor,
                            &id,
                            position,
                            crate::scenario::number("enemyDamage") as u32
                                * number("heavy", "damageMultiplier") as u32,
                            true,
                        );
                        self.world.entity_mut(entity).insert(actor);
                    } else {
                        self.tactical_event(
                            TacticalEvent {
                                target_position: None,
                                action: TacticalAction::Heavy,
                                actor_id: id,
                                target_id: actor.id,
                                phase: TacticalPhase::Rejected,
                                reason_code: Some(
                                    if self.enemies[i].hp == 0 {
                                        "attacker-downed"
                                    } else {
                                        "target-unavailable"
                                    }
                                    .into(),
                                ),
                                values: Default::default(),
                            },
                            None,
                        );
                    }
                }
                continue;
            }
            if self.enemies[i].hp == 0
                || self.enemies[i].travel.is_some()
                || self.tick < state.last_started_tick + number("heavy", "intervalTicks")
            {
                continue;
            }
            let mut targets: Vec<_> = self
                .world
                .query::<&Actor>()
                .iter(&self.world)
                .filter(|a| {
                    a.hp > 0
                        && a.travel.is_none()
                        && a.world_height_milli.unwrap_or(0) == 0
                        && a.room_id == self.enemies[i].room_id
                        && crate::travel::distance(a.world_position, self.enemies[i].world_position)
                            <= crate::scenario::number("attackRange") * 1000
                })
                .cloned()
                .collect();
            targets.sort_by(|a, b| {
                (a.role != "guard")
                    .cmp(&(b.role != "guard"))
                    .then_with(|| a.id.cmp(&b.id))
            });
            if let Some(actor) = targets.first() {
                state.last_started_tick = self.tick;
                state.pending = Some(HeavyAttack {
                    actor_id: actor.id.clone(),
                    started_tick: self.tick,
                    release_tick: self.tick + number("heavy", "telegraphTicks"),
                });
                self.enemies[i].action_tick = self.tick;
                self.enemies[i].action_cue =
                    crate::ActionCue::new("heavy", self.tick, 1, Some(actor.world_position));
                self.tactical_event(
                    TacticalEvent {
                        target_position: None,
                        action: TacticalAction::Heavy,
                        actor_id: id,
                        target_id: actor.id.clone(),
                        phase: TacticalPhase::Telegraph,
                        reason_code: None,
                        values: Default::default(),
                    },
                    None,
                );
            }
        }
    }
}
