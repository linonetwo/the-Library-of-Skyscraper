//! Private authoritative rule memory and declarative tasks.
use crate::{ScriptDecision, Session};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;
pub const MAX_MEMORY_BYTES: usize = 65536;
pub const MAX_TASK_PATCHES: usize = 32;
pub const MAX_TASKS: usize = 128;
pub const MAX_TASK_BYTES: usize = 65536;
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct RuleRuntimeState {
    pub memories: BTreeMap<String, Map<String, Value>>,
    pub tasks: BTreeMap<String, Value>,
}
impl Session {
    pub fn rule_state(&self, owner: &str, hash: Option<&str>) -> Value {
        let state = self.rule_runtime.get(owner);
        let memory = hash
            .and_then(|hash| state?.memories.get(hash))
            .cloned()
            .unwrap_or_default();
        let tasks: Vec<_> = state
            .into_iter()
            .flat_map(|state| state.tasks.values())
            .collect();
        json!({"sourceHash": hash, "memory": memory, "tasks": {"items": tasks}})
    }
    pub(crate) fn prepare_rule_state(
        &mut self,
        decision: &ScriptDecision,
    ) -> Result<RuleRuntimeState, String> {
        let owner = &decision.player_id;
        let snapshot = self.snapshot();
        let owned = |id: &str| {
            snapshot
                .actors
                .iter()
                .any(|a| a.id == id && a.owner == *owner)
        };
        if !self.players.contains_key(owner)
            || decision.intents.len()
                > snapshot.actors.iter().filter(|a| a.owner == *owner).count() * 2
            || decision
                .intents
                .iter()
                .any(|i| !owned(&i.actor_id) || !i.priority.is_finite())
        {
            return Err("invalid script intents or owner".into());
        }
        let mut state = self.rule_runtime.get(owner).cloned().unwrap_or_default();
        let hash = decision.source_hash.as_deref().or_else(|| {
            self.players
                .get(owner)
                .and_then(|p| p.script.as_ref())
                .map(|s| s.source_hash.as_str())
        });
        if let Some(patch) = &decision.memory_patch {
            let hash = hash.ok_or("memory patch requires sourceHash")?;
            let patch: RuleMemoryPatch =
                serde_json::from_value(patch.clone()).map_err(|e| e.to_string())?;
            let memory = state.memories.entry(hash.into()).or_default();
            for key in patch.remove {
                memory.remove(&key);
            }
            memory.extend(patch.set);
            if serde_json::to_vec(memory).unwrap().len() > MAX_MEMORY_BYTES {
                return Err("memory quota exceeded".into());
            }
        }
        if let Some(patches) = &decision.task_patches {
            if patches.len() > MAX_TASK_PATCHES {
                return Err("task patch quota exceeded".into());
            }
            for patch in patches {
                let patch: crate::script_tasks::TaskPatchDraft =
                    serde_json::from_value(patch.clone()).map_err(|e| e.to_string())?;
                match patch {
                    crate::script_tasks::TaskPatchDraft::Remove { task_id } => {
                        state.tasks.remove(&task_id);
                    }
                    crate::script_tasks::TaskPatchDraft::Upsert { task } => {
                        let id = task.id.clone();
                        let view = task.into_view(
                            &snapshot,
                            owner,
                            hash.ok_or("task requires sourceHash")?,
                            self.tick,
                        )?;
                        state.tasks.insert(id, serde_json::to_value(view).unwrap());
                    }
                }
            }
            if state.tasks.len() > MAX_TASKS
                || serde_json::to_vec(&state.tasks.values().collect::<Vec<_>>())
                    .unwrap()
                    .len()
                    > MAX_TASK_BYTES
            {
                return Err("task quota exceeded".into());
            }
        }
        Ok(state)
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RuleMemoryPatch {
    #[serde(default)]
    set: Map<String, Value>,
    #[serde(default)]
    remove: Vec<String>,
}
#[cfg(test)]
mod tests;
