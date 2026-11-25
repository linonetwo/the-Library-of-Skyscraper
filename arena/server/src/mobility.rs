//! Domain constructors shared by manual commands and later typed script intents.
use crate::travel_segments::{linear, refresh};
use crate::{Actor, Point3Milli, Travel, TravelKind, TravelSegment};

fn append(segments: &mut Vec<TravelSegment>, kind: TravelKind, to: Point3Milli) {
    let from = segments.last().map(|s| s.to).unwrap_or(to);
    if from != to {
        segments.push(linear(kind, from, to));
    }
}
fn route(
    start: Point3Milli,
    from: &str,
    target: &str,
    role: &str,
    owner: &str,
    kind: TravelKind,
    via: Option<&str>,
) -> Result<Vec<TravelSegment>, String> {
    let rooms = if let Some(via) = via {
        vec![from.to_owned(), via.to_owned(), target.to_owned()]
    } else {
        crate::travel_map::rooms(from, target)?
    };
    let mut points = vec![start];
    for pair in rooms.windows(2) {
        for point in crate::travel_map::road(&pair[0], &pair[1])? {
            let point = Point3Milli::ground(point);
            if points.last() != Some(&point) {
                points.push(point);
            }
        }
    }
    let end = Point3Milli::ground(crate::travel::slot(target, role, owner));
    if points.last() != Some(&end) {
        points.push(end);
    }
    Ok(points
        .windows(2)
        .filter(|p| p[0] != p[1])
        .map(|p| linear(kind, p[0], p[1]))
        .collect())
}
fn travel(
    actor: &Actor,
    target: &str,
    tick: u64,
    mut segments: Vec<TravelSegment>,
) -> Option<Travel> {
    if segments.is_empty() {
        return None;
    }
    crate::travel_segments::allocate_durations(&mut segments);
    let mut travel = Travel {
        travel_id: format!("{}-{tick}-{target}", actor.id),
        target_room_id: target.into(),
        segments: Some(segments),
        segment_elapsed_micros: Some(0),
        segment: 0,
        path: vec![],
        distance_milli: 0,
        total_distance_milli: 0,
        started_tick: tick,
        speed_milli_per_tick: 750,
        progress: 0.,
    };
    refresh(&mut travel);
    Some(travel)
}
fn install(actor: &mut Actor, target: &str, tick: u64, segments: Vec<TravelSegment>) {
    actor.travel = travel(actor, target, tick, segments);
    actor.state = "moving".into();
    actor.world_height_milli = Some(0);
    actor.locomotion = None;
}
pub fn walk(actor: &mut Actor, target: &str, tick: u64) -> Result<(), String> {
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
    let segments = route(
        Point3Milli::ground(actor.world_position),
        &actor.room_id,
        target,
        &actor.role,
        &actor.owner,
        TravelKind::Walk,
        None,
    )?;
    install(actor, target, tick, segments);
    Ok(())
}
pub fn run(actor: &mut Actor, via: &str, target: &str, tick: u64) -> Result<(), String> {
    available(actor)?;
    if actor.room_id == via || actor.room_id == target || via == target {
        return Err("run requires three different rooms".into());
    }
    crate::travel_map::road(&actor.room_id, via)?;
    crate::travel_map::road(via, target)?;
    if crate::travel_map::rooms(&actor.room_id, target)?.len() != 3 {
        return Err("run endpoints must have ordinary-road distance exactly two edges".into());
    }
    let segments = route(
        Point3Milli::ground(actor.world_position),
        &actor.room_id,
        target,
        &actor.role,
        &actor.owner,
        TravelKind::Run,
        Some(via),
    )?;
    install(actor, target, tick, segments);
    Ok(())
}
fn available(actor: &Actor) -> Result<(), String> {
    if actor.hp == 0 {
        Err("actor downed".into())
    } else if actor.travel.is_some() {
        Err("travel in progress; wait for arrival before changing route".into())
    } else {
        Ok(())
    }
}
pub fn edge(actor: &mut Actor, edge_id: &str, kind: TravelKind, tick: u64) -> Result<(), String> {
    available(actor)?;
    let edge = crate::travel_map::edge(edge_id).ok_or("unknown mobility edge")?;
    if edge.kind != kind {
        return Err("mobility edge does not support this action".into());
    }
    let (target, mut registered) = if actor.room_id == edge.from_room_id {
        (edge.to_room_id, edge.segments)
    } else if actor.room_id == edge.to_room_id {
        let mut s = edge.segments;
        s.reverse();
        for segment in &mut s {
            std::mem::swap(&mut segment.from, &mut segment.to);
        }
        (edge.from_room_id, s)
    } else {
        return Err("actor must be at an endpoint of the mobility edge".into());
    };
    let first = registered
        .first()
        .ok_or("mobility edge has no segments")?
        .from;
    let mut segments = vec![];
    let at = Point3Milli::ground(actor.world_position);
    if at != first {
        segments.push(linear(TravelKind::Walk, at, first));
    }
    segments.append(&mut registered);
    append(
        &mut segments,
        TravelKind::Walk,
        Point3Milli::ground(crate::travel::slot(&target, &actor.role, &actor.owner)),
    );
    install(actor, &target, tick, segments);
    Ok(())
}
/// Replan only from a registered safe ground sample. The integrator retains its time remainder.
pub fn return_at(actor: &Actor, point: Point3Milli, started_tick: u64) -> Option<Travel> {
    let room =
        crate::travel_map::ground_room(point).expect("integrator stops only at registered ground");
    let segments = route(
        point,
        &room,
        "room-0",
        &actor.role,
        &actor.owner,
        TravelKind::Walk,
        None,
    )
    .expect("safe ground has ordinary return road");
    travel(actor, "room-0", started_tick, segments)
}

/// Target selection and pursuit stay on the ground. Height only affects the hit test.
pub fn within_enemy_range(actor: &Actor, enemy: crate::Position, range: u64, version: u32) -> bool {
    if version < 7 {
        return crate::travel::distance(actor.world_position, enemy) <= range;
    }
    if actor.world_height_milli.unwrap_or(0) == 0 {
        return crate::travel::distance(actor.world_position, enemy) <= range;
    }
    let p = Point3Milli::ground(actor.world_position);
    let e = Point3Milli::ground(enemy);
    let dx = p.x as i128 - e.x as i128;
    let dy = p.y as i128 - e.y as i128;
    let z = actor.world_height_milli.unwrap_or(0) as i128;
    dx * dx + dy * dy + z * z <= (range as i128) * (range as i128)
}
