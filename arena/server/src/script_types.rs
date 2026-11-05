use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct SourceProject {
    pub files: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptMetadata {
    pub source_hash: String,
    pub entry: String,
    pub published_at_tick: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PublishedScript {
    pub project: SourceProject,
    pub bundle: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptDecision {
    pub player_id: String,
    pub intents: Vec<ScriptIntent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptIntent {
    pub actor_id: String,
    pub priority: f64,
    #[serde(flatten)]
    pub action: ScriptAction,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScriptAction {
    Move {
        #[serde(rename = "roomId")]
        room_id: String,
    },
    Gather,
    Deliver,
    Attack,
    Capture,
    Build {
        #[serde(rename = "roomId")]
        room_id: String,
        kind: String,
    },
}

impl ScriptIntent {
    pub(crate) fn command(&self) -> crate::Command {
        let actor_id = self.actor_id.clone();
        match &self.action {
            ScriptAction::Move { room_id } => crate::Command::Move {
                actor_id,
                room_id: room_id.clone(),
            },
            ScriptAction::Gather => crate::Command::Gather { actor_id },
            ScriptAction::Deliver => crate::Command::Deliver { actor_id },
            ScriptAction::Attack => crate::Command::Attack { actor_id },
            ScriptAction::Capture => crate::Command::Capture { actor_id },
            ScriptAction::Build { room_id, kind } => crate::Command::Build {
                room_id: room_id.clone(),
                kind: kind.clone(),
            },
        }
    }
}
