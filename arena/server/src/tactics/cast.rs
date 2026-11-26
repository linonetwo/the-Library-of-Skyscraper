use super::{command::unavailable, scenario::number};
use crate::{
    CastState, RecordedChant, Session, SkillId, TacticalAction, TacticalPhase, TacticalValues,
};

impl Session {
    pub(crate) fn start_cast(
        &mut self,
        owner: &str,
        actor_id: &str,
        skill: SkillId,
        target_id: &str,
        chant: &RecordedChant,
        intent_index: usize,
    ) -> Result<(), String> {
        let (entity, mut actor) = self.owned_actor(owner, actor_id)?;
        let index = self.enemies.iter().position(|e| e.id == target_id);
        let state = &self.tactics.as_ref().unwrap().actor_states[actor_id];
        let reason = unavailable(self, &actor).or_else(|| {
            if !actor.appearance.weapon {
                Some("staff-required")
            } else if !chant.is_bound(intent_index, actor_id, target_id, self.tick) {
                Some("chant-context-mismatch")
            } else if self.tick < state.cast_ready_tick {
                Some("cast-cooldown")
            } else if state.energy < number("inkStrike", "energyCost") as u32 {
                Some("insufficient-energy")
            } else {
                match index {
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
                }
            }
        });
        if let Some(reason) = reason {
            self.tactical_reject(
                &actor,
                target_id,
                TacticalAction::Cast,
                reason,
                Default::default(),
            );
            return Ok(());
        }
        let state = self
            .tactics
            .as_mut()
            .unwrap()
            .actor_states
            .get_mut(actor_id)
            .unwrap();
        state.attack_target_id = None;
        let before = state.energy;
        if before == number("inkStrike", "maxEnergy") as u32 {
            state.last_energy_tick = self.tick;
        }
        state.energy -= number("inkStrike", "energyCost") as u32;
        state.cast_ready_tick = self.tick + number("inkStrike", "cooldownTicks");
        let release_tick = self.tick + number("inkStrike", "releaseDelayTicks");
        state.cast = Some(CastState {
            skill_id: skill,
            target_id: target_id.into(),
            started_tick: self.tick,
            release_tick,
            ends_tick: release_tick + number("inkStrike", "recoveryTicks"),
            source_hash: chant.skill_source_hash().to_owned(),
            chant: chant.clone(),
            resolved: false,
        });
        let after = state.energy;
        actor.state = "casting".into();
        self.tactical_result(
            &actor,
            target_id,
            TacticalAction::Cast,
            TacticalPhase::Started,
            None,
            TacticalValues {
                energy_before: Some(before),
                energy_after: Some(after),
                ..Default::default()
            },
        );
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
}
