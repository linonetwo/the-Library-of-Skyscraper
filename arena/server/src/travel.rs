//! Shared map geometry; distances are integer thousandths of a ground tile.
use crate::{Actor, Position, Travel};
pub fn world_map() -> &'static serde_json::Value {
    static MAP: std::sync::OnceLock<serde_json::Value> = std::sync::OnceLock::new();
    MAP.get_or_init(|| serde_json::from_str(include_str!("../../shared/world-map.json")).unwrap())
}
pub fn center(room: &str) -> Position {
    let map = world_map();
    let c = &map["rooms"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == room)
        .unwrap()["center"];
    serde_json::from_value(c.clone()).unwrap()
}
/// Distinct legal work slots keep squad members readable inside a 5x5 room.
pub fn slot(room: &str, role: &str) -> Position {
    let mut p = center(room);
    match role {
        "guard" => p.x += 1.,
        "scout" => {
            p.x -= 1.;
            p.y += 1.;
        }
        _ => {}
    }
    p
}
pub fn distance(a: Position, b: Position) -> u64 {
    (((a.x - b.x).hypot(a.y - b.y)) * 1000.).round() as u64
}
fn route(from: &str, to: &str) -> Vec<Position> {
    if from == to {
        return vec![center(from)];
    }
    let map = world_map();
    let spoke = |id: &str| -> Vec<Position> {
        let l = map["links"]
            .as_array()
            .unwrap()
            .iter()
            .find(|l| l["to"] == id)
            .unwrap();
        serde_json::from_value(l["points"].clone()).unwrap()
    };
    let mut path = if from == "room-0" {
        vec![center(from)]
    } else {
        let mut p = spoke(from);
        p.reverse();
        p
    };
    if to != "room-0" {
        path.extend(spoke(to).into_iter().skip(1));
    }
    path
}
pub fn start(actor: &mut Actor, target: &str, tick: u64) -> Result<(), String> {
    if actor.hp == 0 {
        return Err("actor downed".into());
    }
    if let Some(t) = &actor.travel {
        return if t.target_room_id == target {
            Ok(())
        } else {
            Err("travel in progress; wait for arrival before changing route".into())
        };
    }
    if actor.room_id == target {
        return Ok(());
    }
    let mut path = route(&actor.room_id, target);
    if distance(actor.world_position, path[0]) > 0 {
        path.insert(0, actor.world_position);
    }
    let destination = slot(target, &actor.role);
    if path.last() != Some(&destination) {
        path.push(destination);
    }
    let total = path.windows(2).map(|w| distance(w[0], w[1])).sum();
    actor.travel = Some(Travel {
        travel_id: format!("{}-{tick}-{target}", actor.id),
        target_room_id: target.into(),
        path,
        segment: 0,
        distance_milli: 0,
        total_distance_milli: total,
        started_tick: tick,
        speed_milli_per_tick: crate::scenario::number("speedMilliPerTick"),
        progress: 0.,
    });
    actor.state = "moving".into();
    Ok(())
}
pub fn advance(actor: &mut Actor) -> bool {
    let Some(t) = actor.travel.as_mut() else {
        return false;
    };
    if actor.retreating && t.target_room_id != "room-0" {
        let next = t.distance_milli + t.speed_milli_per_tick;
        let mut node_distance = 0;
        let mut junction = None;
        for w in t.path.windows(2) {
            node_distance += distance(w[0], w[1]);
            if node_distance > t.distance_milli && node_distance <= next {
                junction = Some(w[1]);
                break;
            }
        }
        if let Some(node) = junction {
            actor.world_position = node;
            let map = world_map();
            let found =
                map["rooms"].as_array().unwrap().iter().find(|r| {
                    serde_json::from_value::<Position>(r["center"].clone()).unwrap() == node
                });
            let path = if let Some(room) = found {
                route(room["id"].as_str().unwrap(), "room-0")
            } else {
                let index = t.path.iter().position(|p| *p == node).unwrap_or(t.segment);
                let mut back = t.path[..=index].to_vec();
                back.reverse();
                if back.last() != Some(&center("room-0")) {
                    back.extend(route(&actor.room_id, "room-0").into_iter().skip(1));
                }
                back
            };
            let total = path.windows(2).map(|w| distance(w[0], w[1])).sum();
            if total == 0 {
                actor.room_id = "room-0".into();
                actor.travel = None;
                return true;
            }
            *t = Travel {
                travel_id: format!("{}-retreat-{}", actor.id, t.started_tick),
                target_room_id: "room-0".into(),
                path,
                segment: 0,
                distance_milli: 0,
                total_distance_milli: total,
                started_tick: t.started_tick,
                speed_milli_per_tick: t.speed_milli_per_tick,
                progress: 0.,
            };
            return true;
        }
    }
    let arrived = advance_motion(&mut actor.world_position, &mut actor.travel);
    if let Some(room) = arrived {
        actor.room_id = room;
        actor.state = "idle".into();
    }
    true
}
/// Pure path integrator shared by actors and enemies; no action-source state.
pub fn advance_motion(position: &mut Position, travel: &mut Option<Travel>) -> Option<String> {
    let t = travel.as_mut()?;
    t.distance_milli = (t.distance_milli + t.speed_milli_per_tick).min(t.total_distance_milli);
    let mut remaining = t.distance_milli;
    for (i, w) in t.path.windows(2).enumerate() {
        let len = distance(w[0], w[1]);
        if remaining < len {
            let p = remaining as f64 / len as f64;
            *position = Position {
                x: w[0].x + (w[1].x - w[0].x) * p,
                y: w[0].y + (w[1].y - w[0].y) * p,
            };
            t.segment = i;
            break;
        }
        remaining -= len;
        *position = w[1];
        t.segment = i + 1;
    }
    t.progress = t.distance_milli as f64 / t.total_distance_milli.max(1) as f64;
    if t.distance_milli == t.total_distance_milli {
        let target = t.target_room_id.clone();
        *travel = None;
        Some(target)
    } else {
        None
    }
}

pub fn approach(position: &mut Position, target: Position, stop: u64) {
    let d = distance(*position, target);
    if d > stop {
        let step = (d - stop).min(crate::scenario::number("speedMilliPerTick")) as f64 / d as f64;
        position.x += (target.x - position.x) * step;
        position.y += (target.y - position.y) * step;
        position.x = (position.x * 1000.).round() / 1000.;
        position.y = (position.y * 1000.).round() / 1000.;
    }
}
