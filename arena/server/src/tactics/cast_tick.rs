use super::scenario::number;
use crate::{Actor, Session, TacticalAction, TacticalEvent, TacticalPhase, TacticalValues};

impl Session {
    /// Called after this tick's enemy damage/death, before point resolution.
    pub(crate) fn cast_release_tick(&mut self) {
        let ids: Vec<_> = self
            .tactics
            .as_ref()
            .unwrap()
            .actor_states
            .iter()
            .filter(|(_, s)| {
                s.cast
                    .as_ref()
                    .is_some_and(|c| !c.resolved && c.release_tick <= self.tick)
            })
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            let cast = self.tactics.as_ref().unwrap().actor_states[&id]
                .cast
                .clone()
                .unwrap();
            let actor = self
                .world
                .query::<&Actor>()
                .iter(&self.world)
                .find(|a| a.id == id)
                .unwrap()
                .clone();
            let index = self.enemies.iter().position(|e| e.id == cast.target_id);
            let reason = if actor.hp == 0 {
                Some("actor-downed")
            } else if actor.travel.is_some() {
                Some("actor-travelling")
            } else {
                cast.chant.failure().or_else(|| match index {
                    None => Some("target-gone"),
                    Some(i) if self.enemies[i].hp == 0 => Some("target-gone"),
                    Some(i) if self.enemies[i].room_id != actor.room_id => {
                        Some("target-outside-room")
                    }
                    Some(i)
                        if crate::travel::distance(
                            actor.world_position,
                            self.enemies[i].world_position,
                        ) > number("inkStrike", "rangeMilli") =>
                    {
                        Some("out-of-range")
                    }
                    _ => None,
                })
            };
            let mut values = TacticalValues::default();
            if reason.is_none() {
                let enemy = &mut self.enemies[index.unwrap()];
                values.hp_before = Some(enemy.hp);
                enemy.hp = enemy
                    .hp
                    .saturating_sub(number("inkStrike", "damage") as u32);
                values.hp_after = Some(enemy.hp);
                crate::action_runtime::impact(
                    &mut enemy.action_cue,
                    &mut enemy.impact_cue,
                    enemy.hp,
                    self.tick,
                    actor.world_position,
                    self.simulation_version,
                );
                enemy.state = if enemy.hp == 0 { "downed" } else { "fighting" }.into();
            }
            self.tactics
                .as_mut()
                .unwrap()
                .actor_states
                .get_mut(&id)
                .unwrap()
                .cast
                .as_mut()
                .unwrap()
                .resolved = true;
            self.tactical_event(
                TacticalEvent {
                    target_position: reason
                        .is_none()
                        .then(|| self.enemies[index.unwrap()].world_position),
                    action: TacticalAction::Cast,
                    actor_id: id,
                    target_id: cast.target_id,
                    phase: if reason.is_none() {
                        TacticalPhase::Released
                    } else {
                        TacticalPhase::Rejected
                    },
                    reason_code: reason.map(str::to_owned),
                    values,
                },
                Some(&actor.owner),
            );
        }
        for room in &mut self.rooms {
            room.enemy_hp = self
                .enemies
                .iter()
                .filter(|e| e.room_id == room.id)
                .map(|e| e.hp)
                .sum();
        }
    }
    pub(crate) fn interrupt_cast(&mut self, actor: &Actor, reason: &str) {
        let state = self
            .tactics
            .as_mut()
            .unwrap()
            .actor_states
            .get_mut(&actor.id)
            .unwrap();
        if let Some(cast) = state
            .cast
            .take()
            .filter(|c| !c.resolved && self.tick < c.ends_tick)
        {
            self.tactical_event(
                TacticalEvent {
                    target_position: None,
                    action: TacticalAction::Cast,
                    actor_id: actor.id.clone(),
                    target_id: cast.target_id,
                    phase: TacticalPhase::Interrupted,
                    reason_code: Some(reason.into()),
                    values: Default::default(),
                },
                Some(&actor.owner),
            );
        }
    }
}
