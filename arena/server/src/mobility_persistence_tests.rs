use crate::*;
use serde_json::to_value;
fn actor(s: &mut Session) -> Actor {
    s.owned_actor("p1", "p1-guard").unwrap().1
}
fn advance_until(s: &mut Session, predicate: impl Fn(&Actor) -> bool) {
    for _ in 0..100 {
        if predicate(&actor(s)) {
            return;
        }
        s.advance();
    }
    panic!("target movement sample not reached");
}
#[test]
fn airborne_checkpoint_replay_seek_and_reset_preserve_version_and_sample() {
    let mut s = Session::new("mobility-save".into(), Mode::Training, 42);
    s.join("secret".into()).unwrap();
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-guard".into(),
            room_id: "room-1".into(),
        },
    )
    .unwrap();
    advance_until(&mut s, |a| a.travel.is_none());
    s.command(
        "p1",
        Command::Jump {
            actor_id: "p1-guard".into(),
            edge_id: "jump-room-1-room-2".into(),
        },
    )
    .unwrap();
    advance_until(&mut s, |a| a.world_height_milli.unwrap_or(0) > 0);
    let mut saved = Session::from_checkpoint(s.checkpoint()).unwrap();
    let replay = s.export_replay().unwrap();
    assert_eq!(replay.simulation_version, 7);
    assert_eq!(replay.map_version, "library-v5.0");
    let mut replayed = Session::from_replay(&replay).unwrap();
    let mut seek = replay
        .session_after_operation(replay.operations.len())
        .unwrap();
    for _ in 0..12 {
        let expected = to_value(s.snapshot()).unwrap();
        for other in [&mut saved, &mut replayed, &mut seek] {
            assert_eq!(expected, to_value(other.snapshot()).unwrap());
            other.advance();
        }
        s.advance();
    }
    s.command("p1", Command::Reset {}).unwrap();
    assert_eq!(s.simulation_version, 7);
    assert_eq!(s.snapshot().map_version, "library-v5.0");
    let mut old = Session::new("old-map".into(), Mode::Training, 42);
    old.configure_replay_version(6);
    old.join("old".into()).unwrap();
    old.command(
        "p1",
        Command::Move {
            actor_id: "p1-guard".into(),
            room_id: "room-1".into(),
        },
    )
    .unwrap();
    for _ in 0..4 {
        old.advance();
    }
    assert_eq!(old.snapshot().map_version, "library-v3.5");
    let json = to_value(old.snapshot()).unwrap();
    assert!(json["actors"][0].get("worldHeightMilli").is_none());
    assert!(json["actors"][1]["travel"].get("segments").is_none());
    Session::from_replay(&old.export_replay().unwrap()).unwrap();
    old.command("p1", Command::Reset {}).unwrap();
    assert_eq!(old.simulation_version, 6);
    assert_eq!(old.snapshot().map_version, "library-v3.5");
}
#[test]
fn fixed_point_three_dimensional_hit_range_preserves_old_ground_damage_and_death_sample() {
    // Explicit unit samples, not an assertion of natural mid-air survival.
    for (version, height, damage) in [
        (7, 2001, false),
        (7, 1999, true),
        (7, 0, true),
        (6, 2001, true),
    ] {
        let mut s = Session::new("height-hit".into(), Mode::Training, 42);
        s.configure_replay_version(version);
        s.join("owner".into()).unwrap();
        let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
        a.room_id = "room-3".into();
        a.world_position = s.enemies[0].world_position;
        a.hp = 8;
        a.task = None;
        mobility::walk(&mut a, "room-0", 0).unwrap();
        a.world_height_milli = Some(height);
        let pos = a.world_position;
        s.world.entity_mut(e).insert(a);
        s.tick = 4;
        s.combat_tick();
        let a = actor(&mut s);
        assert_eq!(a.hp == 0, damage);
        assert_eq!(a.world_position, pos);
        assert_eq!(a.world_height_milli, Some(height));
        if damage {
            assert!(a.travel.is_none());
            assert_eq!(a.state, "downed");
        }
    }
}
#[test]
fn preset_retreat_waits_for_safe_ground_and_consumes_only_remaining_time() {
    let mut s = Session::new("safe-return".into(), Mode::Training, 42);
    s.join("owner".into()).unwrap();
    s.enemies.clear();
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.room_id = "room-4".into();
    a.world_position = Position { x: -7., y: 1. };
    a.task = None;
    mobility::edge(&mut a, "climb-room-4-room-3", TravelKind::Climb, 0).unwrap();
    travel::advance(&mut a, 7);
    assert_eq!(a.world_height_milli, Some(500));
    a.retreating = true;
    let mut saw_platform = false;
    let mut returned = false;
    for _ in 0..40 {
        let before = a.motion_distance_milli;
        travel::advance(&mut a, 7);
        assert!(a.motion_distance_milli - before <= 751);
        if a.world_height_milli.unwrap() > 0 {
            saw_platform = true;
            assert_eq!(a.travel.as_ref().unwrap().target_room_id, "room-3");
        }
        if a.travel
            .as_ref()
            .is_some_and(|t| t.target_room_id == "room-0")
        {
            assert_eq!(a.world_height_milli, Some(0));
            returned = true;
            break;
        }
    }
    assert!(saw_platform && returned);
    assert!(travel_map::ground_room(Point3Milli::ground(a.world_position)).is_some());
    s.world.entity_mut(e).insert(a);
}
