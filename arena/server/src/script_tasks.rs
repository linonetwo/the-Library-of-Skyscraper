//! Task draft schema and authoritative provenance.
use crate::Snapshot;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub(crate) enum TaskPatchDraft {
    Upsert {
        task: TaskDraft,
    },
    Remove {
        #[serde(rename = "taskId")]
        task_id: String,
    },
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TaskDraft {
    pub id: String,
    actor_id: String,
    room_id: String,
    kind: TaskKind,
    priority: f64,
    status: TaskStatus,
    #[serde(deserialize_with = "Value::deserialize")]
    blocked_reason: Value,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum TaskKind {
    Move,
    Gather,
    Deliver,
    Build,
    Attack,
    Capture,
}
#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
enum TaskStatus {
    Queued,
    Running,
    Blocked,
    Completed,
    Failed,
    Cancelled,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskView {
    #[serde(flatten)]
    draft: TaskDraft,
    source: &'static str,
    source_hash: String,
    updated_at_tick: u64,
}
impl TaskDraft {
    pub(crate) fn into_view(
        self,
        snapshot: &Snapshot,
        owner: &str,
        hash: &str,
        tick: u64,
    ) -> Result<TaskView, String> {
        if self.id.is_empty()
            || !self.priority.is_finite()
            || !snapshot
                .actors
                .iter()
                .any(|a| a.id == self.actor_id && a.owner == owner)
            || !snapshot.rooms.iter().any(|r| r.id == self.room_id)
        {
            return Err("invalid task target or priority".into());
        }
        let valid_reason = if self.status == TaskStatus::Blocked {
            self.blocked_reason.as_str().is_some_and(|s| !s.is_empty())
        } else {
            self.blocked_reason.is_null()
        };
        if !valid_reason {
            return Err("invalid task blockedReason".into());
        }
        Ok(TaskView {
            draft: self,
            source: "rule",
            source_hash: hash.into(),
            updated_at_tick: tick,
        })
    }
}
