use super::scenario::config;
use crate::{Actor, Position, Session};
use std::collections::{BTreeMap, BTreeSet};

pub(crate) fn point(room: &str) -> Option<&'static serde_json::Value> {
    config()["controlPoints"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["roomId"] == room)
}
pub(crate) fn anchor(room: &str) -> Position {
    serde_json::from_value(point(room).unwrap()["position"].clone()).unwrap()
}
pub(crate) struct Presence {
    pub claimants: BTreeMap<String, Vec<String>>,
    pub blocked: Option<&'static str>,
    pub contested: bool,
}
pub(crate) fn presence(s: &Session, room: &str, actors: &[Actor]) -> Presence {
    let definition = point(room).unwrap();
    let anchor = anchor(room);
    let radius = definition["radiusMilli"].as_u64().unwrap();
    let nearby: Vec<_> = actors
        .iter()
        .filter(|a| {
            a.hp > 0 && crate::mobility::within_enemy_range(a, anchor, radius, s.simulation_version)
        })
        .collect();
    let owners: BTreeSet<_> = nearby.iter().map(|a| a.owner.as_str()).collect();
    let mut claimants: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for a in nearby {
        let recovering = s.tactics.as_ref().unwrap().actor_states[&a.id]
            .recovery
            .as_ref()
            .is_some_and(|r| s.tick < r.ends_tick);
        let casting = s.tactics.as_ref().unwrap().actor_states[&a.id]
            .cast
            .as_ref()
            .is_some_and(|c| s.tick < c.ends_tick);
        if a.room_id == room
            && a.travel.is_none()
            && !a.retreating
            && !recovering
            && !casting
            && a.world_height_milli.unwrap_or(0) == 0
            && a.task
                .as_ref()
                .is_some_and(|t| t.kind == "claim" && t.target == room)
        {
            claimants
                .entry(a.owner.clone())
                .or_default()
                .push(a.id.clone());
        }
    }
    let pve = s.enemies.iter().any(|e| e.room_id == room && e.hp > 0);
    let contested = owners.len() > 1;
    let blocked = if pve {
        Some("point-defended")
    } else if contested {
        Some("point-contested")
    } else if claimants.is_empty() {
        Some("no-claimant")
    } else {
        None
    };
    Presence {
        claimants,
        blocked,
        contested,
    }
}
