use crate::{Actor, Session, TacticalAction, TacticalEvent, TacticalPhase, TacticalValues};

pub(super) fn unavailable(s: &Session, a: &Actor) -> Option<&'static str> {
    if a.hp == 0 {
        Some("actor-downed")
    } else if a.travel.is_some() {
        Some("actor-travelling")
    } else if a.world_height_milli.unwrap_or(0) != 0 {
        Some("actor-not-grounded")
    } else if a.retreating {
        Some("actor-retreating")
    } else if s
        .tactics
        .as_ref()
        .and_then(|t| t.actor_states.get(&a.id))
        .is_some_and(|t| t.recovery.as_ref().is_some_and(|r| s.tick < r.ends_tick))
    {
        Some("actor-recovering")
    } else if s
        .tactics
        .as_ref()
        .and_then(|t| t.actor_states.get(&a.id))
        .is_some_and(|t| t.cast.as_ref().is_some_and(|c| s.tick < c.ends_tick))
    {
        Some("actor-casting")
    } else if s.manual_actions.get(&a.id) == Some(&s.tick) {
        Some("actor-already-acted")
    } else {
        None
    }
}
impl Session {
    pub(super) fn tactical_result(
        &mut self,
        a: &Actor,
        target: &str,
        action: TacticalAction,
        phase: TacticalPhase,
        reason: Option<&str>,
        values: TacticalValues,
    ) {
        let event = TacticalEvent {
            action,
            actor_id: a.id.clone(),
            target_id: target.into(),
            phase,
            reason_code: reason.map(str::to_owned),
            values,
        };
        self.tactical_event(event, Some(&a.owner));
        self.manual_actions.insert(a.id.clone(), self.tick);
    }
    pub(super) fn tactical_event(&mut self, result: TacticalEvent, owner: Option<&str>) {
        let rejected = result.phase == TacticalPhase::Rejected;
        let kind = if rejected && owner.is_some_and(|id| self.players[id].script.is_some()) {
            "script-rejected"
        } else {
            "tactical"
        };
        self.event(
            kind,
            format!(
                "{} → {}: {}",
                result.actor_id,
                result.target_id,
                result.reason_code.as_deref().unwrap_or(if rejected {
                    "rejected"
                } else {
                    "applied"
                })
            ),
            owner,
        );
        self.events.last_mut().unwrap().tactical = Some(result);
    }
    pub(super) fn tactical_reject(
        &mut self,
        a: &Actor,
        target: &str,
        action: TacticalAction,
        reason: &str,
        values: TacticalValues,
    ) {
        self.tactical_result(
            a,
            target,
            action,
            TacticalPhase::Rejected,
            Some(reason),
            values,
        );
    }
}
