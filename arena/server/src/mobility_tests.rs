//! Deterministic domain fixtures; coordinates/HP are explicit unit setup, not live evidence.
use crate::*;
fn game() -> Session {
    let mut s = Session::new("mobility".into(), Mode::Training, 42);
    s.join("owner".into()).unwrap();
    s.enemies.clear();
    let ids: Vec<_> = s.snapshot().actors.iter().map(|a| a.id.clone()).collect();
    for id in ids {
        let (e, mut a) = s.owned_actor("p1", &id).unwrap();
        a.task = None;
        s.world.entity_mut(e).insert(a);
    }
    s
}
fn actor(s: &mut Session) -> Actor {
    s.owned_actor("p1", "p1-gatherer").unwrap().1
}
fn at(s: &mut Session, room: &str, x: f64, y: f64) {
    let (e, mut a) = s.owned_actor("p1", "p1-gatherer").unwrap();
    a.room_id = room.into();
    a.world_position = Position { x, y };
    a.travel = None;
    a.retreating = false;
    s.world.entity_mut(e).insert(a);
}
fn finish(s: &mut Session) -> u64 {
    let start = s.tick;
    for _ in 0..160 {
        if actor(s).travel.is_none() {
            return s.tick - start;
        }
        s.advance();
    }
    panic!("travel did not end");
}
#[test]
fn run_matches_two_ordinary_edges_and_crosses_base_without_side_effects() {
    let mut run = game();
    at(&mut run, "room-1", 8., 0.);
    let (e, mut a) = run.owned_actor("p1", "p1-gatherer").unwrap();
    a.hp = 50;
    a.cargo = 5;
    run.world.entity_mut(e).insert(a);
    let mut walk = Session::from_checkpoint(run.checkpoint()).unwrap();
    run.command(
        "p1",
        Command::Run {
            actor_id: "p1-gatherer".into(),
            via_room_id: "room-0".into(),
            room_id: "room-3".into(),
        },
    )
    .unwrap();
    walk.command(
        "p1",
        Command::Move {
            actor_id: "p1-gatherer".into(),
            room_id: "room-3".into(),
        },
    )
    .unwrap();
    assert_eq!(
        actor(&mut run).travel.unwrap().path,
        actor(&mut walk).travel.unwrap().path
    );
    let materials = run.players["p1"].materials;
    let mut old = actor(&mut run).world_position;
    for tick in 1..=16 {
        run.advance();
        let a = actor(&mut run);
        assert!(travel::distance(old, a.world_position) <= 1501);
        old = a.world_position;
        assert_eq!(a.hp, 50);
        assert_eq!(a.cargo, 5);
        if tick < 16 {
            assert_eq!(a.room_id, "room-1");
            assert!(a.travel.is_some());
        }
    }
    assert!(actor(&mut run).travel.is_none());
    assert_eq!(run.players["p1"].materials, materials);
    assert_eq!(finish(&mut walk), 32);
    assert_eq!(
        actor(&mut run).world_position,
        actor(&mut walk).world_position
    );
}
#[test]
fn jump_has_four_ticks_exact_arc_both_directions_and_no_early_work() {
    for (from, x, y, final_room) in [("room-1", 6., 2., "room-2"), ("room-2", 1., 6.5, "room-1")] {
        let mut s = game();
        at(&mut s, from, x, y);
        s.command(
            "p1",
            Command::Jump {
                actor_id: "p1-gatherer".into(),
                edge_id: "jump-room-1-room-2".into(),
            },
        )
        .unwrap();
        for (i, z) in [900, 1200, 900, 0].into_iter().enumerate() {
            s.advance();
            let a = actor(&mut s);
            assert_eq!(a.world_height_milli, Some(z));
            assert_eq!(a.room_id, from);
            assert_eq!(a.locomotion.as_ref().unwrap().kind, TravelKind::Jump);
            assert_eq!(a.locomotion.as_ref().unwrap().progress, (i + 1) as f64 / 4.);
            assert!(
                s.command(
                    "p1",
                    Command::Gather {
                        actor_id: "p1-gatherer".into()
                    }
                )
                .is_err()
            );
        }
        assert_eq!(
            actor(&mut s).locomotion.unwrap().phase,
            LocomotionPhase::Landing
        );
        finish(&mut s);
        assert_eq!(actor(&mut s).room_id, final_room);
        assert_eq!(actor(&mut s).world_height_milli, Some(0));
    }
}
#[test]
fn climb_uses_registered_ladders_transfers_platform_and_beats_ground_detour() {
    for (from, x, y, to) in [("room-4", -7., 1., "room-3"), ("room-3", -7., 6., "room-4")] {
        let mut s = game();
        at(&mut s, from, x, y);
        let mut ordinary = Session::from_checkpoint(s.checkpoint()).unwrap();
        s.command(
            "p1",
            Command::Climb {
                actor_id: "p1-gatherer".into(),
                edge_id: "climb-room-4-room-3".into(),
            },
        )
        .unwrap();
        ordinary
            .command(
                "p1",
                Command::Move {
                    actor_id: "p1-gatherer".into(),
                    room_id: to.into(),
                },
            )
            .unwrap();
        let mut phases = vec![];
        let mut max = 0;
        while actor(&mut s).travel.is_some() {
            s.advance();
            let a = actor(&mut s);
            max = max.max(a.world_height_milli.unwrap());
            phases.push(a.locomotion.unwrap().phase);
            if s.tick > 100 {
                panic!("climb stalled");
            }
        }
        assert_eq!(max, 1500);
        for p in [
            LocomotionPhase::Grip,
            LocomotionPhase::Crest,
            LocomotionPhase::Traverse,
            LocomotionPhase::Descend,
        ] {
            assert!(phases.contains(&p), "missing {p:?}");
        }
        assert!(s.tick < finish(&mut ordinary));
        assert_eq!(actor(&mut s).room_id, to);
        assert_eq!(actor(&mut s).world_height_milli, Some(0));
    }
}
#[test]
fn one_tick_time_remainder_changes_speed_without_getting_an_extra_tick() {
    let mut s = game();
    let mut a = actor(&mut s);
    a.world_position = Position { x: 0., y: 0. };
    let segments = vec![
        travel_segments::linear(
            TravelKind::Walk,
            Point3Milli { x: 0, y: 0, z: 0 },
            Point3Milli { x: 375, y: 0, z: 0 },
        ),
        travel_segments::linear(
            TravelKind::Run,
            Point3Milli { x: 375, y: 0, z: 0 },
            Point3Milli {
                x: 1875,
                y: 0,
                z: 0,
            },
        ),
    ];
    a.travel = Some(Travel {
        travel_id: "mixed".into(),
        target_room_id: "room-1".into(),
        segments: Some(segments),
        segment_elapsed_micros: Some(0),
        path: vec![],
        segment: 0,
        distance_milli: 0,
        total_distance_milli: 0,
        started_tick: 0,
        speed_milli_per_tick: 750,
        progress: 0.,
    });
    travel::advance(&mut a, 7);
    assert_eq!(a.world_position, Position { x: 1.125, y: 0. });
    let t = a.travel.unwrap();
    assert_eq!(t.segment, 1);
    assert_eq!(t.segment_elapsed_micros, Some(250000));
    assert_eq!(a.motion_distance_milli, 1125);
}
#[test]
fn illegal_domain_inputs_and_manual_script_takeover_reject_without_motion() {
    let mut s = game();
    let before = actor(&mut s).world_position;
    for cmd in [
        Command::Jump {
            actor_id: "p1-gatherer".into(),
            edge_id: "jump-room-1-room-2".into(),
        },
        Command::Run {
            actor_id: "p1-gatherer".into(),
            via_room_id: "room-1".into(),
            room_id: "room-2".into(),
        },
        Command::Climb {
            actor_id: "p2-gatherer".into(),
            edge_id: "climb-room-4-room-3".into(),
        },
    ] {
        assert!(s.command("p1", cmd).is_err());
        assert!(actor(&mut s).travel.is_none());
    }
    s.set_script_metadata(
        "p1",
        Some(ScriptMetadata {
            source_hash: "bound".into(),
            entry: "main.ts".into(),
            published_at_tick: 0,
        }),
    );
    assert!(
        s.command(
            "p1",
            Command::Run {
                actor_id: "p1-gatherer".into(),
                via_room_id: "room-1".into(),
                room_id: "room-2".into()
            }
        )
        .unwrap_err()
        .contains("TypeScript")
    );
    assert_eq!(actor(&mut s).world_position, before);
    s.configure_replay_version(6);
    s.disable_script("p1");
    assert!(
        s.command(
            "p1",
            Command::Jump {
                actor_id: "p1-gatherer".into(),
                edge_id: "jump-room-1-room-2".into()
            }
        )
        .is_err()
    );
}

#[test]
fn registered_landings_have_real_floor_and_clear_existing_prop_footprints() {
    let map = travel_map::world_map(7);
    for edge in map["mobilityEdges"].as_array().unwrap() {
        let segments = edge["segments"].as_array().unwrap();
        for (key, room, raw) in [
            (
                "from",
                edge["fromRoomId"].as_str().unwrap(),
                &segments[0]["from"],
            ),
            (
                "to",
                edge["toRoomId"].as_str().unwrap(),
                &segments.last().unwrap()["to"],
            ),
        ] {
            let p: Point3Milli = serde_json::from_value(raw.clone()).unwrap();
            assert_eq!(travel_map::ground_room(p).as_deref(), Some(room));
            let radius = edge["landingRadiusMilli"].as_f64().unwrap() / 1000.;
            for prop in map["props"].as_array().unwrap() {
                let x = (p.x as f64 / 1000. - prop["position"]["x"].as_f64().unwrap()).abs()
                    - prop["footprint"]["width"].as_f64().unwrap() / 2.;
                let y = (p.y as f64 / 1000. - prop["position"]["y"].as_f64().unwrap()).abs()
                    - prop["footprint"]["depth"].as_f64().unwrap() / 2.;
                assert!(
                    x.max(0.).hypot(y.max(0.)) >= radius,
                    "{} {key} intersects {}",
                    edge["edgeId"],
                    prop["id"]
                );
            }
        }
    }
}
