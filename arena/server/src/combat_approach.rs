use crate::travel::{center, distance, world_map};
use crate::{Position, Travel};

/// Version-5 arrival stops on the incoming road at melee spacing, never past
/// the opponent and back out. Only the imminent, legal target-room tail changes.
pub(crate) fn stop_before_opponent(travel: &mut Option<Travel>, opponents: &[Position]) {
    let Some(t) = travel.as_mut() else { return };
    let c = center(&t.target_room_id);
    let half = world_map()["rooms"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == t.target_room_id)
        .unwrap()["floorHalfSize"]
        .as_f64()
        .unwrap();
    let legal = |p: Position| (p.x - c.x).abs() <= half && (p.y - c.y).abs() <= half;
    let mut offset = 0_u64;
    let mut first: Option<(u64, usize, Position)> = None;
    for (i, w) in t.path.windows(2).enumerate() {
        let len = distance(w[0], w[1]);
        if len > 0 && offset + len > t.distance_milli && legal(w[1]) {
            let dx = w[1].x - w[0].x;
            let dy = w[1].y - w[0].y;
            let aa = dx * dx + dy * dy;
            for p in opponents {
                let x = w[0].x - p.x;
                let y = w[0].y - p.y;
                let bb = x * dx + y * dy;
                let disc = bb * bb - aa * (x * x + y * y - 1.8_f64.powi(2));
                if disc < 0. {
                    continue;
                }
                let fraction = (-bb - disc.sqrt()) / aa;
                if !(0. ..=1.).contains(&fraction) {
                    continue;
                }
                let end = Position {
                    x: ((w[0].x + dx * fraction) * 1000.).round() / 1000.,
                    y: ((w[0].y + dy * fraction) * 1000.).round() / 1000.,
                };
                let at = offset + distance(w[0], end);
                // At a near-edge defender the radial stop may be outside the
                // room. Choose the circle's intersection with the entry edge,
                // within the existing three-tile corridor, before walking it.
                if !legal(end) && offset >= t.distance_milli {
                    let length = aa.sqrt();
                    let normal = Position {
                        x: -dy / length,
                        y: dx / length,
                    };
                    let mut entry_fraction: f64 = 0.;
                    for (start, delta, midpoint) in [(w[0].x, dx, c.x), (w[0].y, dy, c.y)] {
                        if delta != 0. {
                            let a = (midpoint - half - start) / delta;
                            let b = (midpoint + half - start) / delta;
                            entry_fraction = entry_fraction.max(a.min(b));
                        }
                    }
                    let q = Position {
                        x: w[0].x + dx * entry_fraction,
                        y: w[0].y + dy * entry_fraction,
                    };
                    let rx = q.x - p.x;
                    let ry = q.y - p.y;
                    let h = rx * normal.x + ry * normal.y;
                    let discriminant = h * h - rx * rx - ry * ry + 1.8_f64.powi(2);
                    if discriminant >= 0. {
                        for side in [1., -1.] {
                            let lateral = -h + side * discriminant.sqrt();
                            if lateral.abs() > 1.499 {
                                continue;
                            }
                            let point = Position {
                                x: ((q.x + normal.x * lateral) * 1000.).round() / 1000.,
                                y: ((q.y + normal.y * lateral) * 1000.).round() / 1000.,
                            };
                            if !legal(point) {
                                continue;
                            }
                            let mut path = t.path[..=i].to_vec();
                            path.push(point);
                            t.total_distance_milli =
                                path.windows(2).map(|v| distance(v[0], v[1])).sum();
                            t.path = path;
                            return;
                        }
                    }
                }
                if legal(end)
                    && at >= t.distance_milli
                    && at <= t.distance_milli + t.speed_milli_per_tick
                    && first.as_ref().is_none_or(|v| at < v.0)
                {
                    first = Some((at, i, end));
                }
            }
        }
        offset += len;
    }
    if let Some((total, segment, end)) = first {
        t.path.truncate(segment + 1);
        t.path.push(end);
        t.total_distance_milli = total;
    }
}
