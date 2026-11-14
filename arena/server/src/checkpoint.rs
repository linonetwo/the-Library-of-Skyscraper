//! Private, complete simulation saves, independent of public replay limits.
use crate::{ReplayOperation, Session, Snapshot};
use bevy_ecs::prelude::World;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCheckpoint {
    version: u32,
    snapshot: Snapshot,
    tokens: BTreeMap<String, String>,
    manual_actions: BTreeMap<String, u64>,
    next_event: u64,
    replay_operations: Vec<ReplayOperation>,
    replay_overflowed: bool,
    #[serde(default)]
    scripts: BTreeMap<String, crate::PublishedScript>,
}

impl Session {
    pub fn checkpoint(&mut self) -> SessionCheckpoint {
        SessionCheckpoint {
            version: 1,
            snapshot: self.snapshot(),
            tokens: self.tokens.clone(),
            manual_actions: self.manual_actions.clone(),
            next_event: self.next_event,
            replay_operations: self.replay_operations.clone(),
            replay_overflowed: self.replay_overflowed,
            scripts: self.scripts.clone(),
        }
    }

    pub fn from_checkpoint(checkpoint: SessionCheckpoint) -> Result<Self, String> {
        if checkpoint.version != 1 {
            return Err("unsupported session checkpoint version".into());
        }
        let snapshot = checkpoint.snapshot;
        let mut world = World::new();
        world.spawn_batch(snapshot.actors);
        Ok(Self {
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
        })
    }
}
