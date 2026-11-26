//! Private worker sidechannel. These fields are never accepted in Command JSON.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChantRecord {
    pub intent_index: usize,
    pub actor_id: String,
    pub target_id: String,
    pub observed_tick: u64,
    pub skill_source_hash: String,
    pub steps: Vec<ChantStep>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ChantStep {
    pub op: ChantOp,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<usize>,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChantOp {
    Observe,
    Channel,
    Seal,
}
impl ChantRecord {
    pub(crate) fn is_bound(&self, index: usize, actor: &str, target: &str, tick: u64) -> bool {
        self.intent_index == index
            && self.actor_id == actor
            && self.target_id == target
            && self.observed_tick == tick
            && !self.skill_source_hash.is_empty()
    }
    pub(crate) fn failure(&self) -> Option<&str> {
        if let Some(reason) = &self.reason_code {
            return Some(reason);
        }
        if !matches!(
            self.steps.as_slice(),
            [
                ChantStep {
                    op: ChantOp::Observe,
                    from: None
                },
                ChantStep {
                    op: ChantOp::Channel,
                    from: Some(0)
                },
                ChantStep {
                    op: ChantOp::Seal,
                    from: Some(1)
                }
            ]
        ) {
            return Some("chant-mismatch");
        }
        None
    }
}

/// Only the worker variant enters live decisions. Public/other-owner recordings
/// carry the already adjudicated recipe outcome, not a private call path.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum RecordedChant {
    Worker(ChantRecord),
    Verdict(ChantVerdict),
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChantVerdict {
    pub intent_index: usize,
    pub actor_id: String,
    pub target_id: String,
    pub observed_tick: u64,
    pub result: ChantResult,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChantResult {
    Valid,
    ChantError,
    ChantMismatch,
}
impl RecordedChant {
    pub(crate) fn intent_index(&self) -> usize {
        match self {
            Self::Worker(c) => c.intent_index,
            Self::Verdict(c) => c.intent_index,
        }
    }
    pub(crate) fn skill_source_hash(&self) -> &str {
        match self {
            Self::Worker(c) => &c.skill_source_hash,
            Self::Verdict(_) => "redacted",
        }
    }
    pub(crate) fn is_bound(&self, index: usize, actor: &str, target: &str, tick: u64) -> bool {
        match self {
            Self::Worker(c) => c.is_bound(index, actor, target, tick),
            Self::Verdict(c) => {
                c.intent_index == index
                    && c.actor_id == actor
                    && c.target_id == target
                    && c.observed_tick == tick
            }
        }
    }
    pub(crate) fn failure(&self) -> Option<&str> {
        match self {
            Self::Worker(c) => c.failure(),
            Self::Verdict(c) => match c.result {
                ChantResult::Valid => None,
                ChantResult::ChantError => Some("chant-error"),
                ChantResult::ChantMismatch => Some("chant-mismatch"),
            },
        }
    }
    pub(crate) fn redacted(&self) -> Self {
        let Self::Worker(c) = self else {
            return self.clone();
        };
        Self::Verdict(ChantVerdict {
            intent_index: c.intent_index,
            actor_id: c.actor_id.clone(),
            target_id: c.target_id.clone(),
            observed_tick: c.observed_tick,
            result: match c.failure() {
                None => ChantResult::Valid,
                Some("chant-error") => ChantResult::ChantError,
                _ => ChantResult::ChantMismatch,
            },
        })
    }
}
