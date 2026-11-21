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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub script: Option<crate::ScriptMetadata>,
}
#[derive(Component, Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    #[serde(default)]
    pub action_cue: Option<ActionCue>,
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
    #[serde(default)]
    pub world_position: Position,
    #[serde(default)]
    pub travel: Option<Travel>,
    #[serde(default)]
    pub task: Option<ActorTask>,
    #[serde(default)]
    pub action_tick: u64,
    #[serde(default)]
    pub retreating: bool,
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
    #[serde(default)]
    pub world_position: Position,
    #[serde(default)]
    pub hp: u32,
    #[serde(default)]
    pub max_hp: u32,
    #[serde(default)]
    pub construction_ticks: u32,
    #[serde(default)]
    pub required_ticks: u32,
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
    #[serde(default)]
    pub simulation_version: u32,
    #[serde(default)]
    pub map_version: String,
    #[serde(default)]
    pub tick_duration_ms: u32,
    #[serde(default)]
    pub world_map: serde_json::Value,
    #[serde(default)]
    pub scenario_config: serde_json::Value,
    #[serde(default)]
    pub scenario: Scenario,
    #[serde(default)]
    pub enemies: Vec<Enemy>,
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
    Task {
        #[serde(rename = "actorId")]
        actor_id: String,
        kind: String,
        target: String,
        #[serde(default, rename = "buildingKind")]
        building_kind: Option<String>,
    },
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
        #[serde(default, rename = "assignTasks")]
        assign_tasks: bool,
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

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Travel {
    pub travel_id: String,
    pub target_room_id: String,
    pub path: Vec<Position>,
    pub segment: usize,
    pub distance_milli: u64,
    pub total_distance_milli: u64,
    pub started_tick: u64,
    pub speed_milli_per_tick: u64,
    pub progress: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActorTask {
    pub kind: String,
    pub target: String,
    pub stage: String,
    pub blocked_reason: Option<String>,
    pub building_kind: Option<String>,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scenario {
    pub catalog_progress: u32,
    pub counterattack_tick: Option<u64>,
    pub counterattack_spawned: bool,
    pub remaining_ticks: u64,
    pub blocked_reason: Option<String>,
    pub report: Report,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub materials_delivered: u32,
    pub materials_spent: u32,
    pub cargo_lost: u32,
    pub downed: u32,
    pub catalog_ticks: u32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Enemy {
    #[serde(default)]
    pub action_cue: Option<ActionCue>,
    pub id: String,
    pub room_id: String,
    pub hp: u32,
    pub max_hp: u32,
    pub world_position: Position,
    pub state: String,
    pub action_tick: u64,
    pub travel: Option<Travel>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionCue {
    pub kind: String,
    pub started_tick: u64,
    pub duration_ticks: u32,
    pub target_position: Option<Position>,
}
impl ActionCue {
    pub fn new(kind: &str, tick: u64, duration: u32, target: Option<Position>) -> Option<Self> {
        Some(Self {
            kind: kind.into(),
            started_tick: tick,
            duration_ticks: duration,
            target_position: target,
        })
    }
}
