use super::command::unavailable;
use crate::{Session, TacticalAction, TacticalPhase, TacticalValues};

impl Session {
    pub(crate) fn targeted_attack(
        &mut self,
        owner: &str,
        actor_id: &str,
        target_id: &str,
    ) -> Result<(), String> {
        let (entity, mut actor) = self.owned_actor(owner, actor_id)?;
        let index = self.enemies.iter().position(|e| e.id == target_id);
        let reason = unavailable(self, &actor).or_else(|| match index {
            None => Some("target-gone"),
            Some(i) if self.enemies[i].hp == 0 => Some("target-gone"),
            Some(i) if self.enemies[i].room_id != actor.room_id => Some("target-outside-room"),
            _ => None,
        });
        if let Some(reason) = reason {
            self.tactical_reject(
                &actor,
                target_id,
                TacticalAction::Attack,
                reason,
                Default::default(),
            );
            return Ok(());
        }
        let index = index.unwrap();
        let target = self.enemies[index].world_position;
        self.tactics
            .as_mut()
            .unwrap()
            .actor_states
            .get_mut(actor_id)
            .unwrap()
            .attack_target_id = Some(target_id.into());
        if crate::travel::distance(actor.world_position, target)
            > self.scenario_config()["attack"]["rangeMilli"]
                .as_u64()
                .unwrap()
        {
            crate::travel::approach_actor(
                &mut actor,
                target,
                1800,
                self.tick,
                self.simulation_version,
            );
            self.tactical_result(
                &actor,
                target_id,
                TacticalAction::Attack,
                TacticalPhase::Approaching,
                Some("out-of-range"),
                Default::default(),
            );
        } else if self.tick < actor.action_tick + crate::scenario::number("combatIntervalTicks") {
            self.tactical_reject(
                &actor,
                target_id,
                TacticalAction::Attack,
                "attack-cooldown",
                Default::default(),
            );
        } else {
            let before = self.enemies[index].hp;
            let damage = crate::scenario::number(if actor.role == "guard" {
                "guardDamage"
            } else {
                "actorDamage"
            }) as u32;
            let enemy = &mut self.enemies[index];
            enemy.hp = enemy.hp.saturating_sub(damage);
            crate::action_runtime::impact(
                &mut enemy.action_cue,
                &mut enemy.impact_cue,
                enemy.hp,
                self.tick,
                actor.world_position,
                self.simulation_version,
            );
            enemy.state = if enemy.hp == 0 { "downed" } else { "fighting" }.into();
            actor.action_tick = self.tick;
            actor.state = "fighting".into();
            crate::action_runtime::action(
                &mut actor.action_cue,
                crate::ActionCue::new("attack", self.tick, 2, Some(target)).unwrap(),
                self.simulation_version,
            );
            self.tactical_result(
                &actor,
                target_id,
                TacticalAction::Attack,
                TacticalPhase::Applied,
                None,
                TacticalValues {
                    hp_before: Some(before),
                    hp_after: Some(self.enemies[index].hp),
                    ..Default::default()
                },
            );
            for room in &mut self.rooms {
                room.enemy_hp = self
                    .enemies
                    .iter()
                    .filter(|e| e.room_id == room.id)
                    .map(|e| e.hp)
                    .sum();
            }
        }
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
}
