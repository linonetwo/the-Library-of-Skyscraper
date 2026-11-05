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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Response {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure: Option<Failure>,
    pub duration_ms: f64,
}

/// One adapter invocation represents one deterministic rule decision.
pub trait ScriptEngineAdapter {
    fn execute(&self, request: Request) -> Response;
}
