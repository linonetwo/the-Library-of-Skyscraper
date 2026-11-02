//! Versioned, credential-free command recordings, not a persistent storage layer.
use crate::{Command, Mode, Session, Snapshot};
use serde::{Deserialize, Serialize};

pub const REPLAY_VERSION: u32 = 1;
pub const MAX_REPLAY_OPERATIONS: usize = 10_000;
pub const MAX_REPLAY_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Replay {
    pub version: u32,
    pub session_id: String,
    pub mode: Mode,
    pub seed: u64,
    pub operations: Vec<ReplayOperation>,
    pub final_snapshot: Snapshot,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum ReplayOperation {
    Join {
        #[serde(rename = "playerId")]
        player_id: String,
    },
    Command {
        #[serde(rename = "playerId")]
        player_id: String,
        command: Command,
    },
    /// One successful call to the server's tick advancement, including an empty
    /// lobby tick. Pausing is enforced by the caller, just as in the live server.
    Advance {},
}

impl Replay {
    /// Network/file callers must bound input before deserializing.
    pub fn from_json(json: &[u8]) -> Result<Self, String> {
        if json.len() > MAX_REPLAY_BYTES {
            return Err("replay exceeds byte limit".into());
        }
        let replay: Self =
            serde_json::from_slice(json).map_err(|_| "invalid replay JSON".to_string())?;
        replay.validate_limits()?;
        Ok(replay)
    }

    fn validate_limits(&self) -> Result<(), String> {
        if self.version != REPLAY_VERSION {
            return Err("unsupported replay version".into());
        }
        if self.operations.len() > MAX_REPLAY_OPERATIONS {
            return Err("replay exceeds operation limit".into());
        }
        if serde_json::to_vec(self)
            .map_err(|_| "replay serialization failed")?
            .len()
            > MAX_REPLAY_BYTES
        {
            return Err("replay exceeds byte limit".into());
        }
        Ok(())
    }
}

impl Session {
    pub(crate) fn record_operation(&mut self, operation: ReplayOperation) {
        if self.replay_operations.len() >= MAX_REPLAY_OPERATIONS {
            self.replay_overflowed = true;
        } else {
            self.replay_operations.push(operation);
        }
    }

    /// Never returns a truncated recording. A long-running/reset session remains
    /// playable after the recording limit, but cannot claim reproducible export.
    pub fn export_replay(&mut self) -> Result<Replay, String> {
        if self.replay_overflowed {
            return Err("replay recording limit reached; export unavailable".into());
        }
        let replay = Replay {
            version: REPLAY_VERSION,
            session_id: self.id.clone(),
            mode: self.mode,
            seed: self.seed,
            operations: self.replay_operations.clone(),
            final_snapshot: self.snapshot(),
        };
        replay.validate_limits()?;
        Ok(replay)
    }

    /// Rebuild all simulation state (including manual-action cooldowns) and
    /// verify the complete final snapshot. Returned credentials are synthetic;
    /// callers must not publish this object as an authenticated live session.
    pub fn from_replay(replay: &Replay) -> Result<Self, String> {
        replay.validate_limits()?;
        let mut session = Self::new(replay.session_id.clone(), replay.mode, replay.seed);
        for (index, operation) in replay.operations.iter().enumerate() {
            let invalid = || format!("invalid replay operation {index}");
            match operation {
                ReplayOperation::Join { player_id } => {
                    let actual = session
                        .join(format!("replay-only-{index}"))
                        .map_err(|_| invalid())?;
                    if actual != *player_id {
                        return Err(invalid());
                    }
                }
                ReplayOperation::Command { player_id, command } => session
                    .command(player_id, command.clone())
                    .map_err(|_| invalid())?,
                ReplayOperation::Advance {} => {
                    if session.result.is_some() {
                        return Err(invalid());
                    }
                    session.advance();
                }
            }
        }
        if serde_json::to_value(session.snapshot()).map_err(|_| "snapshot serialization failed")?
            != serde_json::to_value(&replay.final_snapshot)
                .map_err(|_| "snapshot serialization failed")?
        {
            return Err("replay final snapshot mismatch".into());
        }
        Ok(session)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trip(session: &mut Session) -> Session {
        let replay = session.export_replay().unwrap();
        let bytes = serde_json::to_vec(&replay).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("live-secret"));
        let decoded = Replay::from_json(&bytes).unwrap();
        let mut restored = Session::from_replay(&decoded).unwrap();
        assert_eq!(
            serde_json::to_value(session.snapshot()).unwrap(),
            serde_json::to_value(restored.snapshot()).unwrap()
        );
        restored
    }

    #[test]
    fn two_player_commands_ticks_rejections_and_future_simulation() {
        let mut session = Session::new("online-replay".into(), Mode::Online, 937);
        session.join("live-secret-one".into()).unwrap();
        session.advance();
        session.join("live-secret-two".into()).unwrap();
        session
            .command(
                "p2",
                Command::Rule {
                    preset: "explore".into(),
                    retreat_hp: 45,
                },
            )
            .unwrap();
        session
            .command(
                "p2",
                Command::Move {
                    actor_id: "p2-gatherer".into(),
                    room_id: "room-1".into(),
                },
            )
            .unwrap();
        let count = session.replay_operations.len();
        assert!(
            session
                .command(
                    "p1",
                    Command::Gather {
                        actor_id: "p2-gatherer".into(),
                    }
                )
                .is_err()
        );
        assert!(session.command("p1", Command::Reset {}).is_err());
        assert!(session.command("p1", Command::Step { ticks: 2 }).is_err());
        assert_eq!(session.replay_operations.len(), count);
        let mut restored = round_trip(&mut session);
        // The snapshot alone does not include the cooldown; subsequent ticks
        // prove the command reconstruction also restores this internal state.
        for _ in 0..120 {
            session.advance();
            restored.advance();
            assert_eq!(
                serde_json::to_value(session.snapshot()).unwrap(),
                serde_json::to_value(restored.snapshot()).unwrap()
            );
        }
        round_trip(&mut session);
    }

    #[test]
    fn training_steps_reset_preserve_history_without_duplicate_ticks_or_joins() {
        let mut session = Session::new("training-replay".into(), Mode::Training, 31);
        session.join("live-secret".into()).unwrap();
        assert!(session.command("p1", Command::Step { ticks: 1 }).is_err());
        session
            .command("p1", Command::Pause { paused: true })
            .unwrap();
        session.command("p1", Command::Step { ticks: 120 }).unwrap();
        assert_eq!(session.replay_operations.len(), 3);
        round_trip(&mut session);
        session.command("p1", Command::Reset {}).unwrap();
        assert_eq!(session.replay_operations.len(), 4);
        assert_eq!(session.tick, 0);
        assert_eq!(session.tokens["live-secret"], "p1");
        session.command("p1", Command::Step { ticks: 12 }).unwrap();
        assert_eq!(session.tick, 12);
        assert_eq!(session.replay_operations.len(), 5);
        round_trip(&mut session);
    }

    #[test]
    fn tampering_versions_invalid_operations_and_limits_rejected() {
        let mut session = Session::new("bounds".into(), Mode::Training, 1);
        session.join("live-secret".into()).unwrap();
        let replay = session.export_replay().unwrap();
        let mut tampered = replay.clone();
        tampered.final_snapshot.tick += 1;
        assert!(Session::from_replay(&tampered).is_err());
        tampered = replay.clone();
        tampered.version += 1;
        assert!(Session::from_replay(&tampered).is_err());
        tampered = replay.clone();
        tampered.operations.push(ReplayOperation::Command {
            player_id: "intruder".into(),
            command: Command::Reset {},
        });
        assert!(Session::from_replay(&tampered).is_err());
        tampered.operations = vec![ReplayOperation::Advance {}; MAX_REPLAY_OPERATIONS + 1];
        assert!(Session::from_replay(&tampered).is_err());
        assert!(Replay::from_json(&vec![b' '; MAX_REPLAY_BYTES + 1]).is_err());
        for _ in 0..MAX_REPLAY_OPERATIONS {
            session
                .command("p1", Command::Pause { paused: true })
                .unwrap();
        }
        assert!(session.export_replay().is_err());
        session.command("p1", Command::Reset {}).unwrap();
        assert!(
            session.export_replay().is_err(),
            "reset cannot erase overflow"
        );
    }
}
