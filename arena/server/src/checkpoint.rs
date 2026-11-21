//! Private, complete simulation saves, independent of public replay limits.
use crate::{ReplayOperation, Session, Snapshot};
use bevy_ecs::prelude::World;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCheckpoint {
    #[serde(default)]
    rule_runtime: BTreeMap<String, crate::script_state::RuleRuntimeState>,
    version: u32,
    #[serde(deserialize_with = "deserialize_snapshot")]
    snapshot: Snapshot,
    tokens: BTreeMap<String, String>,
    manual_actions: BTreeMap<String, u64>,
    next_event: u64,
    replay_operations: Vec<ReplayOperation>,
    replay_overflowed: bool,
    #[serde(default)]
    scripts: BTreeMap<String, crate::PublishedScript>,
    #[serde(default)]
    script_versions: crate::RuleVersionCatalog,
}

impl Session {
    pub fn checkpoint(&mut self) -> SessionCheckpoint {
        SessionCheckpoint {
            rule_runtime: self.rule_runtime.clone(),
            version: 1,
            snapshot: self.snapshot(),
            tokens: self.tokens.clone(),
            manual_actions: self.manual_actions.clone(),
            next_event: self.next_event,
            replay_operations: self.replay_operations.clone(),
            replay_overflowed: self.replay_overflowed,
            scripts: self.scripts.clone(),
            script_versions: self.script_versions.clone(),
        }
    }

    pub fn from_checkpoint(checkpoint: SessionCheckpoint) -> Result<Self, String> {
        if checkpoint.version != 1 {
            return Err("unsupported session checkpoint version".into());
        }
        let snapshot = checkpoint.snapshot;
        let mut world = World::new();
        world.spawn_batch(snapshot.actors);
        let mut session = Self {
            simulation_version: snapshot.simulation_version,
            scenario: snapshot.scenario,
            enemies: snapshot.enemies,
            rule_runtime: checkpoint.rule_runtime,
            id: snapshot.session_id,
            mode: snapshot.mode,
            seed: snapshot.seed,
            tick: snapshot.tick,
            paused: snapshot.paused,
            players: snapshot
                .players
                .into_iter()
                .map(|player| (player.id.clone(), player))
                .collect(),
            tokens: checkpoint.tokens,
            rooms: snapshot.rooms,
            buildings: snapshot.buildings,
            events: snapshot.events,
            result: snapshot.result,
            world,
            next_event: checkpoint.next_event,
            manual_actions: checkpoint.manual_actions,
            replay_operations: checkpoint.replay_operations,
            replay_overflowed: checkpoint.replay_overflowed,
            scripts: checkpoint.scripts,
            script_versions: checkpoint.script_versions,
        };
        session.migrate_script_versions();
        Ok(session)
    }
}

fn deserialize_snapshot<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Snapshot, D::Error> {
    let mut value = serde_json::Value::deserialize(deserializer)?;
    if let Some(actors) = value["actors"].as_array_mut() {
        for actor in actors {
            if actor.get("worldPosition").is_none() {
                let room = actor["roomId"].as_str().unwrap_or("room-0");
                actor["worldPosition"] = serde_json::to_value(crate::travel::center(room)).unwrap();
            }
        }
    }
    let legacy = value["simulationVersion"].as_u64().unwrap_or(0) < 3;
    if let Some(buildings) = value["buildings"].as_array_mut() {
        for b in buildings {
            if b.get("worldPosition").is_none() {
                let room = b["roomId"].as_str().unwrap_or("room-0");
                let kind = b["kind"].as_str().unwrap_or("core");
                b["worldPosition"] = serde_json::to_value(if legacy {
                    crate::travel::center(room)
                } else {
                    crate::travel::build_anchor(room, kind)
                })
                .unwrap();
            }
        }
    }
    serde_json::from_value(value).map_err(serde::de::Error::custom)
}
