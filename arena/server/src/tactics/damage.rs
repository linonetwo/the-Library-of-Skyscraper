//! The original actor damage/death path, shared by ordinary and heavy enemy hits.
use super::scenario::number;
use crate::{
    Actor, Position, RecoveryState, Session, TacticalAction, TacticalEvent, TacticalPhase,
    TacticalValues,
};

impl Session {
    pub(crate) fn hit_actor(
        &mut self,
        actor: &mut Actor,
        enemy_id: &str,
        position: Position,
        damage: u32,
        heavy: bool,
    ) {
        let before = actor.hp;
        actor.hp = actor.hp.saturating_sub(damage);
        crate::action_runtime::impact(
            &mut actor.action_cue,
            &mut actor.impact_cue,
            actor.hp,
            self.tick,
            position,
            self.simulation_version,
        );
        self.event(
            "damage",
            format!(
                "{enemy_id} 对 {} 造成{damage}伤害，HP {}",
                actor.id, actor.hp
            ),
            Some(&actor.owner),
        );
        if heavy {
            self.events.last_mut().unwrap().tactical = Some(TacticalEvent {
                action: TacticalAction::Heavy,
                actor_id: enemy_id.into(),
                target_id: actor.id.clone(),
                phase: TacticalPhase::Applied,
                reason_code: None,
                values: TacticalValues {
                    hp_before: Some(before),
                    hp_after: Some(actor.hp),
                    ..Default::default()
                },
            });
        }
        if actor.hp == 0 {
            actor.travel = None;
            actor.state = "downed".into();
            self.scenario.report.downed += 1;
            self.scenario.report.cargo_lost += actor.cargo;
            actor.cargo = 0;
            self.event(
                "downed",
                format!("{} 倒地，本局无法复活", actor.id),
                Some(&actor.owner),
            );
            if self.simulation_version >= 8 {
                self.interrupt_cast(actor, "actor-downed");
                self.tactics
                    .as_mut()
                    .unwrap()
                    .actor_states
                    .get_mut(&actor.id)
                    .unwrap()
                    .recovery = None;
            }
        } else if heavy {
            self.interrupt_cast(actor, "heavy-hit");
            let state = self
                .tactics
                .as_mut()
                .unwrap()
                .actor_states
                .get_mut(&actor.id)
                .unwrap();
            // Further hits damage normally, retaining the first recovery boundary.
            if !state
                .recovery
                .as_ref()
                .is_some_and(|r| self.tick < r.ends_tick)
            {
                state.recovery = Some(RecoveryState {
                    started_tick: self.tick,
                    rising_tick: self.tick + number("heavy", "downTicks"),
                    ends_tick: self.tick
                        + number("heavy", "downTicks")
                        + number("heavy", "riseTicks"),
                });
                self.tactical_event(
                    TacticalEvent {
                        action: TacticalAction::Recovery,
                        actor_id: actor.id.clone(),
                        target_id: actor.id.clone(),
                        phase: TacticalPhase::Downed,
                        reason_code: None,
                        values: Default::default(),
                    },
                    Some(&actor.owner),
                );
            }
            let recovery = self.tactics.as_ref().unwrap().actor_states[&actor.id]
                .recovery
                .as_ref()
                .unwrap();
            actor.state = if self.tick < recovery.rising_tick {
                "downed"
            } else {
                "rising"
            }
            .into();
        }
    }
}
