//! Presentation facts follow real simulation work. Version 3 retains its recorded
//! single-cue semantics; version 4 records independent action, impact and motion.
use crate::{ActionCue, ActorTask, Position};

pub(crate) fn default_direction() -> Position {
    Position { x: 1., y: 1. }
}

pub(crate) fn stage_tick(version: u32, tick: u64) -> u64 {
    if version >= 4 { tick } else { 0 }
}

/// Task evaluation may visit temporary stages; only its committed stage counts.
pub(crate) fn commit_stage(
    previous: &Option<ActorTask>,
    next: &mut ActorTask,
    tick: u64,
    version: u32,
) {
    next.stage_started_tick = previous
        .as_ref()
        .filter(|old| old.stage == next.stage)
        .map_or_else(|| stage_tick(version, tick), |old| old.stage_started_tick);
}

pub(crate) fn build_stage(actor: &crate::Actor, kind: &str, version: u32) -> String {
    if version >= 4
        && crate::travel::distance(
            actor.world_position,
            crate::travel::build_anchor(&actor.room_id, kind),
        ) > 2000
    {
        "approaching"
    } else {
        "construction"
    }
    .into()
}

/// Repeated build intents retain a continuous work anchor; a new task starts anew.
pub(crate) fn assign_task(
    slot: &mut Option<ActorTask>,
    mut next: ActorTask,
    tick: u64,
    version: u32,
) {
    if let Some(old) = slot.as_ref().filter(|old| {
        version >= 4
            && old.kind == next.kind
            && old.target == next.target
            && old.building_kind == next.building_kind
    }) {
        next.stage = old.stage.clone();
        next.blocked_reason = old.blocked_reason.clone();
        next.stage_started_tick = old.stage_started_tick;
    } else {
        next.stage_started_tick = stage_tick(version, tick);
    }
    *slot = Some(next);
}

#[derive(Default)]
pub(crate) struct Motion {
    pub height_milli: Option<i64>,
    pub locomotion: Option<crate::Locomotion>,
    pub distance_milli: u64,
    pub direction: Position,
}
impl Motion {
    pub fn between(from: Position, to: Position) -> Self {
        Self {
            height_milli: None,
            locomotion: None,
            distance_milli: crate::travel::distance(from, to),
            direction: Position {
                x: to.x - from.x,
                y: to.y - from.y,
            },
        }
    }
    pub fn record(self, version: u32, distance: &mut u64, direction: &mut Position) {
        if version >= 4 && self.distance_milli > 0 {
            *distance += self.distance_milli;
            *direction = self.direction;
        }
    }
}

pub(crate) fn action(slot: &mut Option<ActionCue>, cue: ActionCue, version: u32) {
    fn priority(kind: &str) -> u8 {
        match kind {
            "attack" => 3,
            "deliver" => 2,
            _ => 1,
        }
    }
    if version < 4
        || slot.as_ref().is_none_or(|old| {
            old.started_tick != cue.started_tick || priority(&cue.kind) > priority(&old.kind)
        })
    {
        *slot = Some(cue);
    }
}

pub(crate) fn impact(
    action: &mut Option<ActionCue>,
    impact: &mut Option<ActionCue>,
    hp: u32,
    tick: u64,
    source: Position,
    version: u32,
) {
    let cue = ActionCue::new(
        if hp == 0 { "down" } else { "hit" },
        tick,
        if hp == 0 { 0 } else { 1 },
        Some(source),
    );
    if version < 4 {
        *action = cue;
    } else if hp == 0 || impact.as_ref().is_none_or(|old| old.started_tick != tick) {
        *impact = cue;
    }
}
