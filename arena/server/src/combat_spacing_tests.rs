use crate::*;
fn game(version: u32) -> Session {
    let mut s = Session::new("spacing".into(), Mode::Training, 42);
    s.configure_replay_version(version);
    s.join("token".into()).unwrap();
    s.command(
        "p1",
        Command::Task {
            actor_id: "p1-guard".into(),
            kind: "guard".into(),
            target: "room-3".into(),
            building_kind: None,
        },
    )
    .unwrap();
    s
}
fn guard(s: &mut Session) -> Actor {
    s.snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == "p1-guard")
        .unwrap()
}
#[test]
fn occupied_room_arrival_stays_separate_and_replays_exactly() {
    let mut s = game(5);
    let mut prev = guard(&mut s);
    let mut attacked = false;
    for _ in 0..40 {
        s.advance();
        let a = guard(&mut s);
        assert!(travel::distance(prev.world_position, a.world_position) <= 751);
        if a.action_cue.as_ref().is_some_and(|c| c.kind == "attack") {
            let e = &s.enemies[0];
            let d = travel::distance(a.world_position, e.world_position);
            assert_eq!(a.room_id, e.room_id);
            assert!((1500..=1801).contains(&d), "{d}");
            assert_eq!(
                a.action_cue.as_ref().unwrap().target_position,
                Some(e.world_position)
            );
            attacked = true;
        }
        prev = a;
    }
    assert!(attacked);
    let replay = s.export_replay().unwrap();
    Session::from_replay(&replay).unwrap();
    let mut old = game(4);
    for _ in 0..40 {
        old.advance();
    }
    Session::from_replay(&old.export_replay().unwrap()).unwrap();
}
#[test]
fn center_guardian_arrival_clips_before_center_only_for_new_games() {
    for (version, ticks, end) in [
        (5, 30, Position { x: -8., y: 6.2 }),
        (4, 30, Position { x: -7., y: 8. }),
    ] {
        let mut a = game(version)
            .snapshot()
            .actors
            .into_iter()
            .find(|a| a.id == "p1-guard")
            .unwrap();
        travel::start(&mut a, "room-3", 0).unwrap();
        let targets = [travel::center("room-3")];
        for _ in 0..ticks {
            if version >= 5 {
                travel::stop_before_opponent(&mut a.travel, &targets);
            }
            travel::advance(&mut a, version);
        }
        assert!(a.travel.is_none());
        assert_eq!(a.world_position, end);
        assert_eq!(a.room_id, "room-3");
    }
}
#[test]
fn counterattack_uses_same_road_budget_and_stops_before_defender() {
    let mut p = Position { x: -8., y: 0. };
    let defender = Position { x: -8., y: 8. };
    let mut t = Some(Travel {
        travel_id: "counter".into(),
        target_room_id: "room-3".into(),
        path: vec![p, defender],
        segment: 0,
        distance_milli: 0,
        total_distance_milli: 8000,
        started_tick: 0,
        speed_milli_per_tick: 750,
        progress: 0.,
    });
    let mut arrived = false;
    while t.is_some() {
        travel::stop_before_opponent(&mut t, &[defender]);
        let from = p;
        let (room, motion) = travel::advance_motion(&mut p, &mut t);
        assert!(travel::distance(from, p) <= 750);
        assert!(motion.distance_milli <= 750);
        arrived |= room.as_deref() == Some("room-3");
    }
    assert!(arrived);
    assert_eq!(p, Position { x: -8., y: 6.2 });
    for _ in 0..3 {
        travel::approach(&mut p, defender, 1800);
    }
    assert_eq!(travel::distance(p, defender), 1800);
}
