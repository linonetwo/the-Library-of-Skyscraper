use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    pub source_hash: String,
    pub code: String,
}

#[derive(Deserialize)]
pub struct Request {
    pub bundle: Bundle,
    pub context: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Failure {
    pub kind: String,
    pub message: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChantStep {
    pub op: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<usize>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChantRecord {
    pub intent_index: usize,
    pub actor_id: String,
    pub target_id: String,
    pub observed_tick: u64,
    pub skill_source_hash: String,
    pub steps: Vec<ChantStep>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Response {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure: Option<Failure>,
    pub duration_ms: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chants: Option<Vec<ChantRecord>>,
}

/// One adapter invocation represents one deterministic rule decision.
pub trait ScriptEngineAdapter {
    fn execute(&self, request: Request) -> Response;
}
