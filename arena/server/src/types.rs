use crate::Appearance;
use bevy_ecs::prelude::Component;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Training,
    Online,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub preset: String,
    pub retreat_hp: u32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub materials: u32,
    pub score: u32,
    pub rule: Rule,
}
#[derive(Component, Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    pub id: String,
    pub owner: String,
    pub role: String,
    pub room_id: String,
    pub hp: u32,
    pub max_hp: u32,
    pub state: String,
    pub cargo: u32,
    pub cargo_capacity: u32,
    pub appearance: Appearance,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub q: i32,
    pub r: i32,
    pub name: String,
    pub kind: String,
    pub resources: u32,
    pub enemy_hp: u32,
    pub owner: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Building {
    pub id: String,
    pub owner: String,
    pub room_id: String,
    pub kind: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: u64,
    pub tick: u64,
    pub kind: String,
    pub message: String,
    pub player_id: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ResultSummary {
    pub winner: String,
    pub reason: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub session_id: String,
    pub mode: Mode,
    pub seed: u64,
    pub tick: u64,
    pub paused: bool,
    pub phase: String,
    pub rooms: Vec<Room>,
    pub players: Vec<Player>,
    pub actors: Vec<Actor>,
    pub buildings: Vec<Building>,
    pub events: Vec<Event>,
    pub result: Option<ResultSummary>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum Command {
    Equip {
        #[serde(rename = "actorId")]
        actor_id: String,
        appearance: Appearance,
    },
    Move {
        #[serde(rename = "actorId")]
        actor_id: String,
        #[serde(rename = "roomId")]
        room_id: String,
    },
    Gather {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Deliver {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Attack {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Capture {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Build {
        #[serde(rename = "roomId")]
        room_id: String,
        kind: String,
    },
    Rule {
        preset: String,
        #[serde(rename = "retreatHp")]
        retreat_hp: u32,
    },
    Pause {
        paused: bool,
    },
    Step {
        ticks: u32,
    },
    Reset {},
}
