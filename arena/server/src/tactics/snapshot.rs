use super::point_presence::presence;
use crate::{
    Actor, CastPhase, CastSnapshot, ControlPointSnapshot, RecoveryPhase, RecoverySnapshot, Session,
    TacticalActorSnapshot, TacticalSnapshot,
};
impl Session {
    pub(crate) fn tactical_snapshot(&self, actors: &[Actor]) -> Option<TacticalSnapshot> {
        let state = self.tactics.as_ref()?;
        Some(TacticalSnapshot {
            actor_states: state
                .actor_states
                .iter()
                .map(|(id, t)| {
                    let actor = actors.iter().find(|a| a.id == *id).unwrap();
                    TacticalActorSnapshot {
                        actor_id: id.clone(),
                        weapon: actor.appearance.into(),
                        energy: t.energy,
                        max_energy: 3,
                        cast_ready_tick: t.cast_ready_tick,
                        attack_target_id: t.attack_target_id.clone(),
                        cast: t
                            .cast
                            .as_ref()
                            .filter(|c| self.tick < c.ends_tick)
                            .map(|c| CastSnapshot {
                                skill_id: c.skill_id,
                                target_id: c.target_id.clone(),
                                started_tick: c.started_tick,
                                release_tick: c.release_tick,
                                ends_tick: c.ends_tick,
                                phase: if self.tick < c.release_tick {
                                    CastPhase::Chanting
                                } else if self.tick == c.release_tick {
                                    CastPhase::Release
                                } else {
                                    CastPhase::Recovery
                                },
                            }),
                        recovery: t.recovery.as_ref().filter(|r| self.tick < r.ends_tick).map(
                            |r| RecoverySnapshot {
                                phase: if self.tick < r.rising_tick {
                                    RecoveryPhase::Downed
                                } else {
                                    RecoveryPhase::Rising
                                },
                                started_tick: r.started_tick,
                                rising_tick: r.rising_tick,
                                ends_tick: r.ends_tick,
                            },
                        ),
                    }
                })
                .collect(),
            control_points: state
                .control_points
                .iter()
                .map(|(room, p)| {
                    let current = presence(self, room, actors);
                    ControlPointSnapshot {
                        room_id: room.clone(),
                        challenger_id: p.challenger_id.clone(),
                        progress_ticks: p.progress_ticks,
                        required_ticks: super::point_presence::point(room).unwrap()["requiredTicks"]
                            .as_u64()
                            .unwrap() as u32,
                        contested: current.contested,
                        blocked_reason: current.blocked.map(str::to_owned),
                    }
                })
                .collect(),
        })
    }
}
