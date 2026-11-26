//! Versioned, credential-free command recordings, not a persistent storage layer.
use crate::{Command, Mode, Session, Snapshot};
use serde::{Deserialize, Serialize};

pub const REPLAY_VERSION: u32 = 2;
pub const MAX_REPLAY_OPERATIONS: usize = 10_000;
pub const MAX_REPLAY_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Replay {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scenario_id: Option<crate::ScenarioId>,
    pub version: u32,
    #[serde(default)]
    pub simulation_version: u32,
    #[serde(default)]
    pub map_version: String,
    pub session_id: String,
    pub mode: Mode,
    pub seed: u64,
    pub operations: Vec<ReplayOperation>,
    pub final_snapshot: Snapshot,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub final_rule_state: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum ReplayOperation {
    ScriptPublication {
        #[serde(rename = "playerId")]
        player_id: String,
        script: Option<crate::ScriptMetadata>,
    },
    ScriptAdvance {
        #[serde(default, rename = "runtimeValidated")]
        runtime_validated: bool,
        decisions: Vec<crate::ScriptDecision>,
    },
    Join {
        #[serde(rename = "playerId")]
        player_id: String,
    },
    Command {
        #[serde(rename = "playerId")]
        player_id: String,
        command: Command,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        chant: Option<crate::RecordedChant>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_history: Option<crate::replay_rule_history::RuleHistory>,
}

impl Replay {
    fn initial_session(&self) -> Session {
        let mut session = if self.simulation_version >= 8 {
            Session::new_scenario(
                self.session_id.clone(),
                self.mode,
                self.seed,
                self.scenario_id.unwrap_or_default(),
            )
        } else {
            Session::new(self.session_id.clone(), self.mode, self.seed)
        };
        session.configure_replay_version(self.simulation_version);
        session
    }
    /// Restore the state after exactly N recorded operations (0 is the initial
    /// frame). Used only after the HTTP caller has authorized the recording.
    pub fn session_after_operation(&self, operation_index: usize) -> Result<Session, String> {
        self.validate_limits()?;
        if operation_index > self.operations.len() {
            return Err("operationIndex is outside the recording".into());
        }
        let mut session = self.initial_session();
        for (index, operation) in self.operations[..operation_index].iter().enumerate() {
            session.replay_operations.clear();
            session.replay_operation(index, operation)?;
        }
        Ok(session)
    }

    /// Each frame follows one recorded operation; reset starts a new tick range.
    pub fn timeline(&self) -> Result<ReplayTimeline, String> {
        self.validate_limits()?;
        let mut session = self.initial_session();
        let mut rule_history = crate::replay_rule_history::RuleHistory::for_replay(self);
        let mut frames = Vec::with_capacity(self.operations.len() + 1);
        frames.push(ReplayFrame {
            operation_index: 0,
            tick: session.tick,
            snapshot: session.snapshot(),
        });
        for (index, operation) in self.operations.iter().enumerate() {
            let tick = session.tick;
            // Keep only this operation's normalized committed facts. This also
            // avoids the recording cap during replay reconstruction.
            session.replay_operations.clear();
            session.replay_operation(index, operation)?;
            if let Some(history) = &mut rule_history
                && let Some(committed) = session.replay_operations.last()
            {
                let hash = session
                    .players
                    .get(&history.player_id)
                    .and_then(|player| player.script.as_ref())
                    .map(|script| script.source_hash.as_str());
                history.record(committed, index + 1, tick, hash);
            }
            frames.push(ReplayFrame {
                operation_index: index + 1,
                tick: session.tick,
                snapshot: session.snapshot(),
            });
        }
        Ok(ReplayTimeline {
            session_id: self.session_id.clone(),
            frames,
            rule_history,
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
        if self.version != 1 && self.version != REPLAY_VERSION {
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
    pub(crate) fn configure_replay_version(&mut self, version: u32) {
        self.simulation_version = version;
        if version < 3 {
            self.paused = false;
            self.enemies.clear();
            self.scenario = Default::default();
            for (i, r) in self.rooms.iter_mut().enumerate() {
                r.resources = if r.kind == "resource" {
                    160 + (self.seed % 41) as u32
                } else {
                    0
                };
                r.enemy_hp = if i == 3 || i == 6 {
                    60 + (self.seed % 21) as u32
                } else {
                    0
                };
            }
        }
    }
    fn replay_operation(
        &mut self,
        index: usize,
        operation: &ReplayOperation,
    ) -> Result<(), String> {
        let invalid = || format!("invalid replay operation {index}");
        match operation {
            ReplayOperation::ScriptPublication { player_id, script } => {
                if !self.players.contains_key(player_id) {
                    return Err(invalid());
                }
                self.set_script_metadata(player_id, script.clone());
            }
            ReplayOperation::ScriptAdvance {
                decisions,
                runtime_validated,
            } => {
                if self.result.is_some() {
                    return Err(invalid());
                }
                self.advance_scripted_recorded(decisions.clone(), *runtime_validated);
            }
            ReplayOperation::Join { player_id } => {
                let actual = self
                    .join(format!("replay-only-{index}"))
                    .map_err(|_| invalid())?;
                if actual != *player_id {
                    return Err(invalid());
                }
            }
            ReplayOperation::Command {
                player_id,
                command,
                chant,
            } => {
                if let Some(chant) = chant {
                    self.command_with_chant(player_id, command.clone(), chant.clone())
                } else {
                    self.command(player_id, command.clone())
                }
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
    /// Current committed recording boundary, including commands at the same tick.
    pub fn recorded_operation_index(&self) -> Option<usize> {
        (!self.replay_overflowed).then_some(self.replay_operations.len())
    }

    pub fn export_replay(&mut self) -> Result<Replay, String> {
        self.export_replay_for(None)
    }
    pub fn export_replay_for(&mut self, owner: Option<&str>) -> Result<Replay, String> {
        if self.replay_overflowed {
            return Err("replay recording limit reached; export unavailable".into());
        }
        let mut replay = Replay {
            scenario_id: self.scenario_id,
            version: REPLAY_VERSION,
            simulation_version: self.simulation_version,
            map_version: if self.simulation_version >= 3 {
                crate::travel_map::world_map(self.simulation_version)["version"]
                    .as_str()
                    .unwrap()
                    .into()
            } else {
                String::new()
            },
            session_id: self.id.clone(),
            mode: self.mode,
            seed: self.seed,
            operations: self.replay_operations.clone(),
            final_snapshot: self.snapshot(),
            final_rule_state: None,
        };
        for operation in &mut replay.operations {
            if let ReplayOperation::Command {
                player_id,
                chant: Some(chant),
                ..
            } = operation
            {
                if Some(player_id.as_str()) != owner {
                    *chant = chant.redacted();
                }
            }
            if let ReplayOperation::ScriptAdvance { decisions, .. } = operation {
                for decision in decisions {
                    if Some(decision.player_id.as_str()) != owner {
                        decision.memory_patch = None;
                        decision.task_patches = None;
                        if let Some(chants) = &mut decision.chants {
                            *chants = chants.iter().map(crate::RecordedChant::redacted).collect();
                        }
                    }
                }
            }
        }
        replay.final_rule_state = owner.map(|owner| serde_json::json!({"playerId":owner,"state":self.rule_runtime.get(owner).cloned().unwrap_or_default()}));
        replay.validate_limits()?;
        Ok(replay)
    }

    /// Rebuild all simulation state (including manual-action cooldowns) and
    /// verify the complete final snapshot. Returned credentials are synthetic;
    /// callers must not publish this object as an authenticated live session.
    pub fn from_replay(replay: &Replay) -> Result<Self, String> {
        replay.validate_limits()?;
        let mut session = replay.initial_session();
        for (index, operation) in replay.operations.iter().enumerate() {
            session.replay_operation(index, operation)?;
        }
        let mut expected = replay.final_snapshot.clone();
        if replay.simulation_version < 3 {
            for a in &mut expected.actors {
                a.world_position = crate::travel::center(&a.room_id);
            }
            for b in &mut expected.buildings {
                b.world_position = crate::travel::center(&b.room_id);
            }
        }
        let actual = session.snapshot();
        // Decorative props are not collision or simulation inputs. Permit a new
        // presentation layout only when every gameplay map field is unchanged.
        if replay.simulation_version >= 3 {
            let mut previous_map = expected.world_map.clone();
            let mut current_map = actual.world_map.clone();
            for map in [&mut previous_map, &mut current_map] {
                if let Some(object) = map.as_object_mut() {
                    object.remove("props");
                    object.remove("version");
                }
            }
            if previous_map == current_map {
                expected.world_map = actual.world_map.clone();
                expected.map_version = actual.map_version.clone();
            }
        }
        if serde_json::to_value(&actual).map_err(|_| "snapshot serialization failed")?
            != serde_json::to_value(&expected).map_err(|_| "snapshot serialization failed")?
        {
            return Err("replay final snapshot mismatch".into());
        }
        if let Some(final_state) = &replay.final_rule_state {
            let owner = final_state["playerId"]
                .as_str()
                .ok_or("invalid finalRuleState owner")?;
            if serde_json::to_value(session.rule_runtime.get(owner).cloned().unwrap_or_default())
                .unwrap()
                != final_state["state"]
            {
                return Err("replay final rule state mismatch".into());
            }
        }
        Ok(session)
    }
}

#[cfg(test)]
#[path = "replay_tests.rs"]
mod tests;
