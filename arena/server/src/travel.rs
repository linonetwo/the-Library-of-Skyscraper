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
pub fn slot(room: &str, role: &str, owner: &str) -> Position {
    let mut p = center(room);
    p.x += match role {
        "guard" => 1.,
        "scout" => -1.,
        _ => 0.,
    };
    p.y += match owner {
        "p2" => 1.,
        "p3" => -1.,
        "p4" => 2.,
        _ => 0.,
    };
    p
}
pub fn build_anchor(room: &str, kind: &str) -> Position {
    let c = center(room);
    let offset = &world_map()["buildOffsets"][kind];
    Position {
        x: c.x + offset["x"].as_f64().unwrap_or(0.),
        y: c.y + offset["y"].as_f64().unwrap_or(0.),
    }
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
pub fn start_for_version(
    actor: &mut Actor,
    target: &str,
    tick: u64,
    version: u32,
) -> Result<(), String> {
    if version >= 7 {
        crate::mobility::walk(actor, target, tick)
    } else {
        start(actor, target, tick)
    }
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
    let destination = slot(target, &actor.role, &actor.owner);
    if path.last() != Some(&destination) {
        path.push(destination);
    }
    let total = path.windows(2).map(|w| distance(w[0], w[1])).sum();
    actor.travel = Some(Travel {
        segments: None,
        segment_elapsed_micros: None,
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
pub fn advance(actor: &mut Actor, version: u32) -> bool {
    if version >= 7 && actor.travel.as_ref().is_some_and(|t| t.segments.is_some()) {
        return advance_segmented_actor(actor, version);
    }
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
            crate::action_runtime::Motion::between(actor.world_position, node).record(
                version,
                &mut actor.motion_distance_milli,
                &mut actor.last_move_direction,
            );
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
                segments: None,
                segment_elapsed_micros: None,
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
    let (arrived, motion) = advance_motion(&mut actor.world_position, &mut actor.travel);
    motion.record(
        version,
        &mut actor.motion_distance_milli,
        &mut actor.last_move_direction,
    );
    if let Some(room) = arrived {
        actor.room_id = room;
        actor.state = "idle".into();
    }
    true
}
/// Pure path integrator shared by actors and enemies; no action-source state.
pub fn advance_motion(
    position: &mut Position,
    travel: &mut Option<Travel>,
) -> (Option<String>, crate::action_runtime::Motion) {
    if travel.as_ref().is_some_and(|t| t.segments.is_some()) {
        let step = crate::travel_segments::advance(
            position,
            travel,
            crate::travel_segments::TICK_MICROS,
            false,
        );
        return (step.arrived, step.motion);
    }
    let Some(t) = travel.as_mut() else {
        return (None, Default::default());
    };
    let old_distance = t.distance_milli;
    t.distance_milli = (t.distance_milli + t.speed_milli_per_tick).min(t.total_distance_milli);
    let mut motion = crate::action_runtime::Motion::default();
    let mut offset = 0;
    for w in t.path.windows(2) {
        let len = distance(w[0], w[1]);
        let moved = t
            .distance_milli
            .min(offset + len)
            .saturating_sub(old_distance.max(offset));
        if moved > 0 {
            motion.distance_milli += moved;
            motion.direction = Position {
                x: w[1].x - w[0].x,
                y: w[1].y - w[0].y,
            };
        }
        offset += len;
    }
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
        (Some(target), motion)
    } else {
        (None, motion)
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

/// One authority tick has one actor movement budget across road and room work.
pub fn approach_actor(a: &mut Actor, target: Position, stop: u64, tick: u64, version: u32) {
    if a.last_moved_tick == tick || a.hp == 0 || a.travel.is_some() {
        return;
    }
    if distance(a.world_position, target) > stop {
        let from = a.world_position;
        approach(&mut a.world_position, target, stop);
        crate::action_runtime::Motion::between(from, a.world_position).record(
            version,
            &mut a.motion_distance_milli,
            &mut a.last_move_direction,
        );
        a.last_moved_tick = tick;
    }
}

/// Enemy pursuit uses the same displacement record and movement budget as roads.
pub fn approach_enemy(e: &mut crate::Enemy, target: Position, stop: u64, tick: u64, version: u32) {
    if e.last_moved_tick == tick || e.hp == 0 || e.travel.is_some() {
        return;
    }
    let from = e.world_position;
    approach(&mut e.world_position, target, stop);
    let motion = crate::action_runtime::Motion::between(from, e.world_position);
    if version >= 4 && motion.distance_milli > 0 {
        e.last_moved_tick = tick;
    }
    motion.record(
        version,
        &mut e.motion_distance_milli,
        &mut e.last_move_direction,
    );
}

/// Both ordinary and special segments consume this single tick's time remainder.
fn advance_segmented_actor(actor: &mut Actor, version: u32) -> bool {
    let mut remaining = crate::travel_segments::TICK_MICROS;
    loop {
        let return_pending = actor.retreating
            && actor
                .travel
                .as_ref()
                .is_some_and(|t| t.target_room_id != "room-0");
        let started = actor.travel.as_ref().unwrap().started_tick;
        let step = crate::travel_segments::advance(
            &mut actor.world_position,
            &mut actor.travel,
            remaining,
            return_pending,
        );
        actor.world_height_milli = step.motion.height_milli;
        actor.locomotion = step.motion.locomotion.clone();
        step.motion.record(
            version,
            &mut actor.motion_distance_milli,
            &mut actor.last_move_direction,
        );
        remaining = step.remaining_micros;
        if step.safe_stop {
            actor.travel = crate::mobility::return_at(
                actor,
                crate::Point3Milli::ground(actor.world_position),
                started,
            );
            if actor.travel.is_none() {
                actor.room_id = "room-0".into();
                actor.state = "idle".into();
                break;
            }
            if remaining > 0 {
                continue;
            }
        } else if let Some(room) = step.arrived {
            actor.room_id = room;
            actor.state = "idle".into();
        }
        break;
    }
    true
}
