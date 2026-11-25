//! Fixed-point samples on the one authority time budget. No gameplay callbacks.
use crate::{
    Locomotion, LocomotionPhase, Point3Milli, Position, SegmentRole, Travel, TravelKind,
    TravelSegment,
};
pub const TICK_MICROS: u64 = 500_000;

pub fn rounded_div(n: i128, d: i128) -> i64 {
    let rounded = (n.abs() + d / 2) / d;
    (if n < 0 { -rounded } else { rounded }) as i64
}
pub fn length(from: Point3Milli, to: Point3Milli, include_height: bool) -> u64 {
    let dx = to.x as i128 - from.x as i128;
    let dy = to.y as i128 - from.y as i128;
    let dz = if include_height {
        to.z as i128 - from.z as i128
    } else {
        0
    };
    let square = (dx * dx + dy * dy + dz * dz) as u128;
    let root = square.isqrt();
    (root + u128::from(square - root * root > root)) as u64
}
pub fn linear(kind: TravelKind, from: Point3Milli, to: Point3Milli) -> TravelSegment {
    let length_milli = length(from, to, true);
    TravelSegment {
        kind,
        role: if kind == TravelKind::Climb {
            if from.z == to.z {
                SegmentRole::Transfer
            } else {
                SegmentRole::Ladder
            }
        } else {
            SegmentRole::Ground
        },
        from,
        to,
        length_milli,
        duration_micros: (length_milli * TICK_MICROS).div_ceil(kind.speed()),
        edge_id: None,
        ladder_facing: None,
        arc_height_milli: None,
    }
}
/// Speeds have a common third-microsecond denominator. Round cumulative time,
/// not each segment independently, so an exact 24m run remains exactly16 ticks.
pub fn allocate_durations(segments: &mut [TravelSegment]) {
    let mut thirds = 0_u64;
    let mut rounded = 0_u64;
    for s in segments {
        thirds += if s.kind == TravelKind::Jump {
            2_000_000 * 3
        } else {
            s.length_milli * (TICK_MICROS * 3 / s.kind.speed())
        };
        let next = thirds.div_ceil(3);
        s.duration_micros = next - rounded;
        rounded = next;
    }
}
pub fn point(segment: &TravelSegment, elapsed: u64) -> Point3Milli {
    let d = segment.duration_micros.max(1) as i128;
    let e = elapsed.min(segment.duration_micros) as i128;
    let at = |a: i64, b: i64| a + rounded_div((b as i128 - a as i128) * e, d);
    let mut p = Point3Milli {
        x: at(segment.from.x, segment.to.x),
        y: at(segment.from.y, segment.to.y),
        z: at(segment.from.z, segment.to.z),
    };
    if segment.kind == TravelKind::Jump {
        p.z += rounded_div(
            4 * segment.arc_height_milli.unwrap_or(0) as i128 * e * (d - e),
            d * d,
        );
    }
    p
}
fn sample(segment: &TravelSegment, elapsed: u64) -> Locomotion {
    let u = elapsed as f64 / segment.duration_micros.max(1) as f64;
    let phase = match segment.role {
        SegmentRole::Gap if u <= 0.25 => LocomotionPhase::Takeoff,
        SegmentRole::Gap if u >= 0.75 => LocomotionPhase::Landing,
        SegmentRole::Gap => LocomotionPhase::Airborne,
        SegmentRole::Ladder if segment.to.z > segment.from.z => LocomotionPhase::Grip,
        SegmentRole::Ladder => LocomotionPhase::Descend,
        SegmentRole::Transfer => LocomotionPhase::Crest,
        SegmentRole::Traverse => LocomotionPhase::Traverse,
        SegmentRole::Ground if segment.kind == TravelKind::Run => LocomotionPhase::Run,
        SegmentRole::Ground => LocomotionPhase::Walk,
    };
    Locomotion {
        kind: segment.kind,
        phase,
        progress: u,
    }
}
/// Compatibility views are derived only from canonical segment index + local time.
pub fn refresh(travel: &mut Travel) {
    let segments = travel.segments.as_ref().expect("segmented travel");
    travel.path = segments
        .first()
        .map(|s| {
            std::iter::once(s.from.xy())
                .chain(segments.iter().map(|s| s.to.xy()))
                .collect()
        })
        .unwrap_or_default();
    travel.total_distance_milli = segments.iter().map(|s| s.length_milli).sum();
    let prefix: u64 = segments
        .iter()
        .take(travel.segment)
        .map(|s| s.length_milli)
        .sum();
    let elapsed_prefix: u64 = segments
        .iter()
        .take(travel.segment)
        .map(|s| s.duration_micros)
        .sum();
    let local = travel.segment_elapsed_micros.unwrap_or(0);
    travel.distance_milli = prefix
        + segments
            .get(travel.segment)
            .map_or(0, |s| s.length_milli * local / s.duration_micros.max(1));
    let duration: u64 = segments.iter().map(|s| s.duration_micros).sum();
    travel.progress = (elapsed_prefix + local) as f64 / duration.max(1) as f64;
    if let Some(s) = segments.get(travel.segment) {
        travel.speed_milli_per_tick = s.kind.speed();
    }
}
pub struct Advance {
    pub arrived: Option<String>,
    pub motion: crate::action_runtime::Motion,
    pub safe_stop: bool,
    pub remaining_micros: u64,
}
pub fn advance(
    position: &mut Position,
    travel: &mut Option<Travel>,
    mut budget: u64,
    stop_at_ground: bool,
) -> Advance {
    let t = travel.as_mut().expect("travel");
    let segments = t.segments.as_ref().expect("segmented");
    let mut motion = crate::action_runtime::Motion::default();
    let mut safe_stop = false;
    while let Some(segment) = segments.get(t.segment) {
        let old = t.segment_elapsed_micros.unwrap_or(0);
        let step = budget.min(segment.duration_micros.saturating_sub(old));
        let elapsed = old + step;
        let before = point(segment, old);
        let after = point(segment, elapsed);
        *position = after.xy();
        motion.height_milli = Some(after.z);
        motion.locomotion = Some(sample(segment, elapsed));
        let moved = segment.length_milli * elapsed / segment.duration_micros.max(1)
            - segment.length_milli * old / segment.duration_micros.max(1);
        if moved > 0 {
            motion.distance_milli += moved;
            motion.direction = if before.x != after.x || before.y != after.y {
                Position {
                    x: (segment.to.x - segment.from.x) as f64 / 1000.,
                    y: (segment.to.y - segment.from.y) as f64 / 1000.,
                }
            } else {
                segment.ladder_facing.unwrap_or(Position { x: 0., y: 1. })
            };
        }
        budget -= step;
        t.segment_elapsed_micros = Some(elapsed);
        if elapsed == segment.duration_micros {
            t.segment += 1;
            t.segment_elapsed_micros = Some(0);
            if stop_at_ground && crate::travel_map::ground_room(after).is_some() {
                safe_stop = true;
                break;
            }
        } else {
            break;
        }
        if budget == 0 {
            if segment.kind != TravelKind::Jump
                && let Some(next) = segments.get(t.segment)
            {
                motion.locomotion = Some(sample(next, 0));
            }
            break;
        }
    }
    refresh(t);
    let arrived = if t.segment == t.segments.as_ref().unwrap().len() {
        Some(t.target_room_id.clone())
    } else {
        None
    };
    if arrived.is_some() && !safe_stop {
        *travel = None;
    }
    Advance {
        arrived,
        motion,
        safe_stop,
        remaining_micros: budget,
    }
}
