//! Private, owner-scoped replay deltas; never copy final runtime state into frames.
use crate::{
    Command,
    replay::{Replay, ReplayOperation},
};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleHistory {
    pub player_id: String,
    pub changes: Vec<RuleHistoryChange>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum RuleHistoryChange {
    Patch {
        #[serde(rename = "operationIndex")]
        operation_index: usize,
        tick: u64,
        #[serde(rename = "sourceHash")]
        source_hash: Option<String>,
        #[serde(rename = "memoryPatch", skip_serializing_if = "Option::is_none")]
        memory_patch: Option<Value>,
        #[serde(rename = "taskPatches", skip_serializing_if = "Option::is_none")]
        task_patches: Option<Vec<Value>>,
    },
    Reset {
        #[serde(rename = "operationIndex")]
        operation_index: usize,
        reset: bool,
    },
}

impl RuleHistory {
    pub(crate) fn for_replay(replay: &Replay) -> Option<Self> {
        if replay.version < 2 {
            return None;
        }
        let player_id = replay
            .final_rule_state
            .as_ref()?
            .get("playerId")?
            .as_str()?
            .to_owned();
        Some(Self {
            player_id,
            changes: Vec::new(),
        })
    }

    pub(crate) fn record(
        &mut self,
        operation: &ReplayOperation,
        operation_index: usize,
        tick: u64,
        active_hash: Option<&str>,
    ) {
        match operation {
            ReplayOperation::Command {
                command: Command::Reset {},
                ..
            } => {
                self.changes.push(RuleHistoryChange::Reset {
                    operation_index,
                    reset: true,
                });
            }
            ReplayOperation::ScriptAdvance {
                runtime_validated: true,
                decisions,
            } => {
                for decision in decisions {
                    if decision.player_id != self.player_id || decision.failure.is_some() {
                        continue;
                    }
                    let source_hash = decision.source_hash.as_deref().or(active_hash);
                    if decision.memory_patch.is_none() && decision.task_patches.is_none() {
                        continue;
                    }
                    self.changes.push(RuleHistoryChange::Patch {
                        operation_index,
                        tick,
                        source_hash: source_hash.map(str::to_owned),
                        memory_patch: decision.memory_patch.clone(),
                        task_patches: decision.task_patches.clone(),
                    });
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ScriptDecision;
    use serde_json::json;

    #[test]
    fn deltas_are_owner_scoped_successful_and_indexed_across_resets() {
        let decision = |player: &str, hash: &str| ScriptDecision {
            chants: None,
            player_id: player.into(),
            source_hash: Some(hash.into()),
            memory_patch: Some(json!({"set":{"counter":1}})),
            task_patches: None,
            intents: vec![],
            failure: None,
        };
        let mut history = RuleHistory {
            player_id: "p1".into(),
            changes: vec![],
        };
        let mut failed = decision("p1", "failed");
        failed.failure = Some("invalid batch".into());
        history.record(
            &ReplayOperation::ScriptAdvance {
                runtime_validated: true,
                decisions: vec![decision("p2", "secret"), failed, decision("p1", "A")],
            },
            3,
            0,
            None,
        );
        history.record(
            &ReplayOperation::ScriptAdvance {
                runtime_validated: false,
                decisions: vec![decision("p1", "legacy")],
            },
            4,
            1,
            None,
        );
        history.record(
            &ReplayOperation::Command {
                chant: None,
                player_id: "p1".into(),
                command: Command::Reset {},
            },
            5,
            1,
            None,
        );
        for (index, hash) in [(6, "B"), (7, "A")] {
            history.record(
                &ReplayOperation::ScriptAdvance {
                    runtime_validated: true,
                    decisions: vec![decision("p1", hash)],
                },
                index,
                0,
                None,
            );
        }
        let value = serde_json::to_value(&history).unwrap();
        assert_eq!(value["changes"].as_array().unwrap().len(), 4);
        assert_eq!(value["changes"][0]["operationIndex"], 3);
        assert_eq!(
            value["changes"][1],
            json!({"operationIndex":5,"reset":true})
        );
        assert_eq!(value["changes"][2]["tick"], 0);
        assert_eq!(value["changes"][3]["sourceHash"], "A");
        let encoded = value.to_string();
        assert!(!encoded.contains("secret"));
        assert!(!encoded.contains("failed"));
        assert!(!encoded.contains("legacy"));
        assert!(encoded.len() < 600);
    }

    #[test]
    fn old_and_public_replays_have_no_private_history() {
        let mut session = crate::Session::new("history".into(), crate::Mode::Training, 1);
        let mut replay = session.export_replay_for(None).unwrap();
        assert!(RuleHistory::for_replay(&replay).is_none());
        replay.final_rule_state =
            Some(json!({"playerId":"p1","state":{"memory":"x".repeat(65536)}}));
        let history = RuleHistory::for_replay(&replay).unwrap();
        assert!(serde_json::to_vec(&history).unwrap().len() < 100);
        replay.version = 1;
        assert!(RuleHistory::for_replay(&replay).is_none());
    }
    #[test]
    fn timeline_projects_committed_batches_and_hash_fallback_or_null_remove() {
        let mut session = crate::Session::new("normalized".into(), crate::Mode::Training, 1);
        let owner = session.join("token".into()).unwrap();
        let mut replay = session.export_replay_for(Some(&owner)).unwrap();
        replay.operations.push(ReplayOperation::ScriptPublication {
            player_id: owner.clone(),
            script: Some(crate::ScriptMetadata {
                source_hash: "bound".into(),
                entry: "main.ts".into(),
                published_at_tick: 0,
            }),
        });
        let decision = |memory_patch, task_patches| ScriptDecision {
            chants: None,
            player_id: owner.clone(),
            source_hash: None,
            memory_patch,
            task_patches,
            intents: vec![],
            failure: None,
        };
        replay.operations.push(ReplayOperation::ScriptAdvance {
            runtime_validated: true,
            decisions: vec![decision(Some(json!({"set":{"count":1}})), None)],
        });
        // A valid memory patch plus an invalid task is rejected atomically.
        replay.operations.push(ReplayOperation::ScriptAdvance {
            runtime_validated: true,
            decisions: vec![decision(
                Some(json!({"set":{"count":999}})),
                Some(vec![json!({"type":"invalid"})]),
            )],
        });
        replay.operations.push(ReplayOperation::ScriptPublication {
            player_id: owner.clone(),
            script: None,
        });
        replay.operations.push(ReplayOperation::ScriptAdvance {
            runtime_validated: true,
            decisions: vec![decision(
                None,
                Some(vec![json!({"type":"remove","taskId":"absent"})]),
            )],
        });
        let value = serde_json::to_value(replay.timeline().unwrap()).unwrap();
        let changes = value["ruleHistory"]["changes"].as_array().unwrap();
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0]["sourceHash"], "bound");
        assert_eq!(changes[0]["memoryPatch"]["set"]["count"], 1);
        assert!(changes[1]["sourceHash"].is_null());
        assert_eq!(changes[1]["taskPatches"][0]["type"], "remove");
    }
}
