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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayFrame {
    pub operation_index: usize,
    pub tick: u64,
    pub snapshot: Snapshot,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayTimeline {
    pub session_id: String,
    pub frames: Vec<ReplayFrame>,
}

impl Replay {
    /// Each frame follows one recorded operation; reset starts a new tick range.
    pub fn timeline(&self) -> Result<ReplayTimeline, String> {
        self.validate_limits()?;
        let mut session = Session::new(self.session_id.clone(), self.mode, self.seed);
        let mut frames = Vec::with_capacity(self.operations.len() + 1);
        frames.push(ReplayFrame {
            operation_index: 0,
            tick: session.tick,
            snapshot: session.snapshot(),
        });
        for (index, operation) in self.operations.iter().enumerate() {
            session.replay_operation(index, operation)?;
            frames.push(ReplayFrame {
                operation_index: index + 1,
                tick: session.tick,
                snapshot: session.snapshot(),
            });
        }
        Ok(ReplayTimeline {
            session_id: self.session_id.clone(),
            frames,
        })
    }

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
    fn replay_operation(
        &mut self,
        index: usize,
        operation: &ReplayOperation,
    ) -> Result<(), String> {
        let invalid = || format!("invalid replay operation {index}");
        match operation {
            ReplayOperation::Join { player_id } => {
                let actual = self
                    .join(format!("replay-only-{index}"))
                    .map_err(|_| invalid())?;
                if actual != *player_id {
                    return Err(invalid());
                }
            }
            ReplayOperation::Command { player_id, command } => {
                self.command(player_id, command.clone())
                    .map_err(|_| invalid())?;
            }
            ReplayOperation::Advance {} => {
                if self.result.is_some() {
                    return Err(invalid());
                }
                self.advance();
            }
        }
        Ok(())
    }
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
            session.replay_operation(index, operation)?;
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
#[path = "replay_tests.rs"]
mod tests;
