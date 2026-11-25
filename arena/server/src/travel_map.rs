//! Versioned map facts and deterministic ordinary-road adjacency. No screen geometry.
use crate::{TravelKind, TravelSegment};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, VecDeque};

pub fn world_map(version: u32) -> &'static serde_json::Value {
    if version < 7 {
        return crate::travel::world_map();
    }
    static MAP: std::sync::OnceLock<serde_json::Value> = std::sync::OnceLock::new();
    MAP.get_or_init(|| {
        serde_json::from_str(include_str!("../../shared/world-map-v5.json")).unwrap()
    })
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobilityEdge {
    pub edge_id: String,
    pub kind: TravelKind,
    pub from_room_id: String,
    pub to_room_id: String,
    pub segments: Vec<TravelSegment>,
}
pub fn edge(edge_id: &str) -> Option<MobilityEdge> {
    world_map(7)["mobilityEdges"]
        .as_array()?
        .iter()
        .find(|edge| edge["edgeId"] == edge_id)
        .map(|edge| serde_json::from_value(edge.clone()).expect("registered mobility edge"))
}
pub fn rooms(from: &str, to: &str) -> Result<Vec<String>, String> {
    let map = world_map(7);
    let known = |id: &str| {
        map["rooms"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["id"] == id)
    };
    if !known(from) || !known(to) {
        return Err("unknown room".into());
    }
    let mut adjacency: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for link in map["links"].as_array().unwrap() {
        let a = link["from"].as_str().unwrap();
        let b = link["to"].as_str().unwrap();
        adjacency.entry(a.into()).or_default().insert(b.into());
        adjacency.entry(b.into()).or_default().insert(a.into());
    }
    let mut queue = VecDeque::from([vec![from.to_owned()]]);
    let mut visited = BTreeSet::from([from.to_owned()]);
    while let Some(path) = queue.pop_front() {
        let last = path.last().unwrap();
        if last == to {
            return Ok(path);
        }
        for next in adjacency.get(last).into_iter().flatten() {
            if visited.insert(next.clone()) {
                let mut p = path.clone();
                p.push(next.clone());
                queue.push_back(p);
            }
        }
    }
    Err("no ordinary road route".into())
}
pub fn road(from: &str, to: &str) -> Result<Vec<crate::Position>, String> {
    let map = world_map(7);
    for link in map["links"].as_array().unwrap() {
        if link["from"] == from && link["to"] == to {
            return Ok(serde_json::from_value(link["points"].clone()).unwrap());
        }
        if link["from"] == to && link["to"] == from {
            let mut points: Vec<crate::Position> =
                serde_json::from_value(link["points"].clone()).unwrap();
            points.reverse();
            return Ok(points);
        }
    }
    Err("rooms do not share an ordinary road".into())
}

pub fn ground_room(point: crate::Point3Milli) -> Option<String> {
    if point.z != 0 {
        return None;
    }
    world_map(7)["rooms"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|r| {
            let c = &r["center"];
            let half = r["floorHalfSize"].as_f64().unwrap() * 1000.;
            (point.x as f64 - c["x"].as_f64().unwrap() * 1000.).abs() <= half
                && (point.y as f64 - c["y"].as_f64().unwrap() * 1000.).abs() <= half
        })
        .min_by_key(|r| {
            crate::travel::distance(
                point.xy(),
                serde_json::from_value(r["center"].clone()).unwrap(),
            )
        })
        .map(|r| r["id"].as_str().unwrap().to_owned())
}
