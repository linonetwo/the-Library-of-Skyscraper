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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chants: Option<Vec<crate::RecordedChant>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_patch: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_patches: Option<Vec<Value>>,
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
    Run {
        #[serde(rename = "viaRoomId")]
        via_room_id: String,
        #[serde(rename = "roomId")]
        room_id: String,
    },
    Jump {
        #[serde(rename = "edgeId")]
        edge_id: String,
    },
    Climb {
        #[serde(rename = "edgeId")]
        edge_id: String,
    },
    Gather,
    Deliver,
    Attack {
        #[serde(default, rename = "targetId", skip_serializing_if = "Option::is_none")]
        target_id: Option<String>,
    },
    Repair {
        #[serde(rename = "buildingId")]
        building_id: String,
    },
    Claim {
        #[serde(rename = "roomId")]
        room_id: String,
    },
    Cast {
        #[serde(rename = "skillId")]
        skill_id: crate::SkillId,
        #[serde(rename = "targetId")]
        target_id: String,
    },
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
            ScriptAction::Run {
                via_room_id,
                room_id,
            } => crate::Command::Run {
                actor_id,
                via_room_id: via_room_id.clone(),
                room_id: room_id.clone(),
            },
            ScriptAction::Jump { edge_id } => crate::Command::Jump {
                actor_id,
                edge_id: edge_id.clone(),
            },
            ScriptAction::Climb { edge_id } => crate::Command::Climb {
                actor_id,
                edge_id: edge_id.clone(),
            },
            ScriptAction::Gather => crate::Command::Gather { actor_id },
            ScriptAction::Deliver => crate::Command::Deliver { actor_id },
            ScriptAction::Attack { target_id } => crate::Command::Attack {
                actor_id,
                target_id: target_id.clone(),
            },
            ScriptAction::Repair { building_id } => crate::Command::Repair {
                actor_id,
                building_id: building_id.clone(),
            },
            ScriptAction::Claim { room_id } => crate::Command::Claim {
                actor_id,
                room_id: room_id.clone(),
            },
            ScriptAction::Cast {
                skill_id,
                target_id,
            } => crate::Command::Cast {
                actor_id,
                skill_id: *skill_id,
                target_id: target_id.clone(),
            },
            ScriptAction::Capture => crate::Command::Capture { actor_id },
            ScriptAction::Build { room_id, kind } => crate::Command::Build {
                room_id: room_id.clone(),
                kind: kind.clone(),
            },
        }
    }
}

#[cfg(test)]
mod mobility_tests {
    use super::*;
    #[test]
    fn intents_map_to_the_same_domain_commands() {
        for action in [
            serde_json::json!({"type":"run","viaRoomId":"room-0","roomId":"room-3"}),
            serde_json::json!({"type":"jump","edgeId":"jump-room-1-room-2"}),
            serde_json::json!({"type":"climb","edgeId":"climb-room-4-room-3"}),
            serde_json::json!({"type":"attack"}),
            serde_json::json!({"type":"attack","targetId":"drill-guardian-b"}),
            serde_json::json!({"type":"repair","buildingId":"p1-drill-warehouse"}),
            serde_json::json!({"type":"claim","roomId":"room-2"}),
        ] {
            let mut wire = action.clone();
            wire["actorId"] = serde_json::json!("p1-guard");
            wire["priority"] = serde_json::json!(50);
            let intent: ScriptIntent = serde_json::from_value(wire).unwrap();
            let mut expected = action;
            expected["actorId"] = serde_json::json!("p1-guard");
            assert_eq!(serde_json::to_value(intent.command()).unwrap(), expected);
        }
    }
}
