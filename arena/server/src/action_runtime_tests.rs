use crate::*;

fn game(version: u32) -> Session {
    let mut s = Session::new("action-facts".into(), Mode::Training, 42);
    s.configure_replay_version(version);
    s.join("token".into()).unwrap();
    s
}
fn actor(s: &mut Session, role: &str) -> Actor {
    s.snapshot()
        .actors
        .into_iter()
        .find(|a| a.role == role)
        .unwrap()
}
fn task(s: &mut Session, role: &str, kind: &str, target: &str) {
    s.command(
        "p1",
        Command::Task {
            actor_id: format!("p1-{role}"),
            kind: kind.into(),
            target: target.into(),
            building_kind: None,
        },
    )
    .unwrap();
}
fn duel() -> Session {
    let mut s = game(4);
    s.players.get_mut("p1").unwrap().rule.retreat_hp = 0;
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.world_position = crate::travel::center("room-3");
    a.room_id = "room-3".into();
    s.world.entity_mut(e).insert(a);
    s
}

#[test]
fn synchronous_combat_retains_both_attack_and_impact_then_terminal_down() {
    let mut s = duel();
    for tick in 1..=8 {
        s.advance();
        if tick % 4 == 0 {
            let a = actor(&mut s, "guard");
            let enemy = &s.enemies[0];
            for (active, impact) in [
                (&a.action_cue, &a.impact_cue),
                (&enemy.action_cue, &enemy.impact_cue),
            ] {
                assert_eq!(active.as_ref().unwrap().kind, "attack");
                assert_eq!(impact.as_ref().unwrap().kind, "hit");
                assert_eq!(active.as_ref().unwrap().started_tick, tick);
                assert_eq!(impact.as_ref().unwrap().started_tick, tick);
            }
        }
    }
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.hp = 1;
    s.world.entity_mut(e).insert(a);
    for _ in 0..4 {
        s.advance();
    }
    let down = actor(&mut s, "guard");
    assert_eq!(down.hp, 0);
    assert_eq!(down.action_cue.as_ref().unwrap().kind, "attack");
    let impact = down.impact_cue.unwrap();
    assert_eq!(
        (
            impact.kind.as_str(),
            impact.started_tick,
            impact.duration_ticks
        ),
        ("down", 12, 0)
    );
    for _ in 0..8 {
        s.advance();
    }
    let still = actor(&mut s, "guard");
    assert_eq!(still.impact_cue.unwrap().started_tick, 12);
    assert_eq!(still.world_position, down.world_position);
    assert_eq!(still.state, "downed");
}

#[test]
fn multiple_real_hits_preserve_first_source_and_lethal_hit_upgrades_to_down() {
    let mut s = duel();
    let mut second = s.enemies[0].clone();
    second.id = "second".into();
    second.world_position.x += 1.;
    s.enemies.push(second);
    for _ in 0..4 {
        s.advance();
    }
    let a = actor(&mut s, "guard");
    assert_eq!(a.hp, 84); // Both eight-damage hits apply.
    assert_eq!(
        a.impact_cue.unwrap().target_position,
        Some(s.enemies[0].world_position)
    );
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.hp = 12;
    s.world.entity_mut(e).insert(a);
    for _ in 0..4 {
        s.advance();
    }
    let a = actor(&mut s, "guard");
    assert_eq!(a.hp, 0);
    let down = a.impact_cue.unwrap();
    assert_eq!(down.kind, "down");
    assert_eq!(down.target_position, Some(s.enemies[1].world_position));
}

#[test]
fn road_turn_counts_path_length_and_room_delivery_counts_only_real_motion() {
    let mut s = game(4);
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-gatherer".into(),
            room_id: "room-3".into(),
        },
    )
    .unwrap();
    for _ in 0..22 {
        s.advance();
    }
    let a = actor(&mut s, "gatherer");
    assert_eq!(a.motion_distance_milli, 16000);
    assert_eq!(a.last_move_direction.x, 0.);
    assert!(a.last_move_direction.y > 0.);
    // One tick crosses a right-angle bend; accumulated distance is not its chord.
    let mut p = Position { x: 0., y: 0. };
    let mut travel = Some(Travel {
        travel_id: "turn".into(),
        target_room_id: "room-0".into(),
        path: vec![p, Position { x: 0.5, y: 0. }, Position { x: 0.5, y: 1. }],
        segment: 0,
        distance_milli: 0,
        total_distance_milli: 1500,
        started_tick: 0,
        speed_milli_per_tick: 750,
        progress: 0.,
    });
    let (_, motion) = crate::travel::advance_motion(&mut p, &mut travel);
    assert_eq!(motion.distance_milli, 750);
    assert_eq!(motion.direction, Position { x: 0., y: 1. });

    let mut s = game(4);
    let (e, mut a) = s.owned_actor("p1", "p1-gatherer").unwrap();
    a.cargo = 4;
    s.world.entity_mut(e).insert(a);
    for _ in 0..10 {
        s.command(
            "p1",
            Command::Deliver {
                actor_id: "p1-gatherer".into(),
            },
        )
        .unwrap();
    }
    assert_eq!(actor(&mut s, "gatherer").motion_distance_milli, 0);
    s.advance();
    let delivered = actor(&mut s, "gatherer");
    assert_eq!(delivered.cargo, 0);
    assert!((749..=751).contains(&delivered.motion_distance_milli));
    assert_eq!(delivered.action_cue.unwrap().kind, "deliver");
    for _ in 0..10 {
        s.advance();
    }
    let stopped = actor(&mut s, "gatherer");
    assert_eq!(
        stopped.motion_distance_milli,
        delivered.motion_distance_milli
    );
    assert_eq!(stopped.last_move_direction, delivered.last_move_direction);
}

#[test]
fn manual_task_and_script_travel_emit_the_same_motion_facts() {
    let mut manual = game(4);
    manual
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-gatherer".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    let mut tasked = game(4);
    task(&mut tasked, "gatherer", "gather", "room-1");
    tasked.advance(); // Task schedules travel; movement starts on the next tick.
    let mut scripted = game(4);
    scripted.set_script_metadata(
        "p1",
        Some(ScriptMetadata {
            source_hash: "move".into(),
            entry: "main.ts".into(),
            published_at_tick: 0,
        }),
    );
    let decisions = vec![ScriptDecision {
        player_id: "p1".into(),
        source_hash: None,
        memory_patch: None,
        task_patches: None,
        failure: None,
        intents: serde_json::from_value(
            serde_json::json!([{"type":"move","actorId":"p1-gatherer","roomId":"room-1","priority":1}]),
        )
        .unwrap(),
    }];
    scripted.advance_scripted(decisions);
    manual.advance();
    tasked.advance();
    for _ in 1..11 {
        manual.advance();
        tasked.advance();
        scripted.advance_scripted(vec![]);
    }
    let reference = actor(&mut manual, "gatherer");
    for s in [&mut tasked, &mut scripted] {
        let a = actor(s, "gatherer");
        assert_eq!(a.motion_distance_milli, reference.motion_distance_milli);
        assert_eq!(a.last_move_direction, reference.last_move_direction);
        assert_eq!(a.world_position, reference.world_position);
    }
    assert_eq!(reference.motion_distance_milli, 8000);
}

#[test]
fn stage_anchor_changes_on_committed_transition_and_not_repeated_work_or_block() {
    let mut s = game(4);
    task(&mut s, "gatherer", "gather", "room-1");
    for _ in 0..12 {
        s.advance();
    }
    let t = actor(&mut s, "gatherer").task.unwrap();
    assert_eq!(t.stage, "gathering");
    assert_eq!(t.stage_started_tick, 12);
    for _ in 0..3 {
        s.advance();
    }
    assert_eq!(
        actor(&mut s, "gatherer").task.unwrap().stage_started_tick,
        12
    );
}

#[test]
fn blocked_work_and_repeated_script_build_keep_their_stage_anchor() {
    let mut s = game(4);
    task(&mut s, "scout", "gather", "room-0");
    s.advance();
    let blocked = actor(&mut s, "scout").task.unwrap();
    assert_eq!(blocked.stage, "blocked");
    for _ in 0..6 {
        s.advance();
    }
    assert_eq!(
        actor(&mut s, "scout").task.unwrap().stage_started_tick,
        blocked.stage_started_tick
    );
    // Existing real scripted-build path gets repeated intents while the same job runs.
    s.players.get_mut("p1").unwrap().materials = 100;
    s.build_with_actor("p1", "p1-scout", "room-0", "tower")
        .unwrap();
    for _ in 0..5 {
        s.advance();
        s.build_with_actor("p1", "p1-scout", "room-0", "tower")
            .unwrap();
    }
    let working = actor(&mut s, "scout").task.unwrap();
    assert_eq!(working.stage, "construction");
    let started = working.stage_started_tick;
    for _ in 0..3 {
        s.advance();
        s.build_with_actor("p1", "p1-scout", "room-0", "tower")
            .unwrap();
    }
    assert_eq!(
        actor(&mut s, "scout").task.unwrap().stage_started_tick,
        started
    );
}

#[test]
fn attack_wins_same_tick_delivery_in_either_real_action_order() {
    for attack_first in [false, true] {
        let mut s = game(4);
        s.tick = 4;
        let (_, mut a) = s.owned_actor("p1", "p1-gatherer").unwrap();
        a.cargo = 4;
        a.world_position = crate::travel::build_anchor("room-0", "warehouse");
        s.enemies[0].world_position = a.world_position;
        if attack_first {
            s.actor_attack(&mut a).unwrap();
            s.deposit(&mut a).unwrap();
        } else {
            s.deposit(&mut a).unwrap();
            s.actor_attack(&mut a).unwrap();
        }
        assert_eq!(a.cargo, 0);
        assert_eq!(s.players["p1"].materials, 14);
        assert_eq!(a.action_cue.unwrap().kind, "attack");
    }
}

#[test]
fn real_guard_pursuit_and_counterattack_road_record_enemy_motion() {
    let mut s = duel();
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.world_position.x += 3.;
    s.world.entity_mut(e).insert(a);
    s.advance();
    assert_eq!(s.enemies[0].motion_distance_milli, 750);
    assert!(s.enemies[0].last_move_direction.x > 0.);
    let mut s = game(4);
    s.command(
        "p1",
        Command::Rule {
            preset: "gather".into(),
            retreat_hp: 35,
            assign_tasks: true,
        },
    )
    .unwrap();
    for _ in 0..960 {
        if s.result.is_some() {
            break;
        }
        s.advance();
    }
    assert!(s.result.is_some());
    let counter = s
        .enemies
        .iter()
        .find(|e| e.id == "guardian-counterattack")
        .unwrap();
    assert!(counter.motion_distance_milli >= 8000);
    assert!(counter.last_move_direction.x != 0. || counter.last_move_direction.y != 0.);
}

#[test]
fn v4_checkpoint_and_random_seek_keep_idle_direction_and_distance() {
    let mut s = game(4);
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-gatherer".into(),
            room_id: "room-1".into(),
        },
    )
    .unwrap();
    for _ in 0..30 {
        s.advance();
    }
    let a = actor(&mut s, "gatherer");
    let mut restored = Session::from_checkpoint(
        serde_json::from_slice(&serde_json::to_vec(&s.checkpoint()).unwrap()).unwrap(),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(restored.snapshot()).unwrap(),
        serde_json::to_value(s.snapshot()).unwrap()
    );
    let replay = s.export_replay().unwrap();
    Session::from_replay(&replay).unwrap();
    let timeline = replay.timeline().unwrap();
    for tick in [30, 11, 25, 15] {
        let frame = timeline.frames.iter().find(|f| f.tick == tick).unwrap();
        let found = frame
            .snapshot
            .actors
            .iter()
            .find(|e| e.role == "gatherer")
            .unwrap();
        assert_eq!(found.last_move_direction, a.last_move_direction);
        assert_eq!(found.motion_distance_milli, 8000);
    }
}

#[test]
fn missing_v3_fields_keep_old_hit_overwrite_and_strict_replay_chain() {
    let mut s = game(3);
    task(&mut s, "guard", "guard", "room-3");
    for _ in 0..25 {
        s.advance();
    }
    assert_eq!(actor(&mut s, "guard").action_cue.unwrap().kind, "hit");
    let mut json = serde_json::to_value(s.checkpoint()).unwrap();
    strip_fields(&mut json["snapshot"]);
    let mut restored = Session::from_checkpoint(serde_json::from_value(json).unwrap()).unwrap();
    assert_eq!(restored.simulation_version, 3);
    for a in restored.snapshot().actors {
        assert_eq!(a.motion_distance_milli, 0);
        assert_eq!(a.last_move_direction, Position { x: 1., y: 1. });
        assert!(a.impact_cue.is_none());
        assert_eq!(a.task.map(|t| t.stage_started_tick).unwrap_or(0), 0);
    }
    for _ in 0..4 {
        restored.advance();
    }
    let mut replay = serde_json::to_value(restored.export_replay().unwrap()).unwrap();
    strip_fields(&mut replay["finalSnapshot"]);
    let replay = Replay::from_json(&serde_json::to_vec(&replay).unwrap()).unwrap();
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    assert_eq!(
        serde_json::to_value(rebuilt.snapshot()).unwrap(),
        serde_json::to_value(restored.snapshot()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(
            replay
                .timeline()
                .unwrap()
                .frames
                .last()
                .unwrap()
                .snapshot
                .clone()
        )
        .unwrap(),
        serde_json::to_value(restored.snapshot()).unwrap()
    );
}
fn strip_fields(snapshot: &mut serde_json::Value) {
    for key in ["actors", "enemies"] {
        for a in snapshot[key].as_array_mut().unwrap() {
            for field in ["impactCue", "motionDistanceMilli", "lastMoveDirection"] {
                a.as_object_mut().unwrap().remove(field);
            }
            if let Some(t) = a.get_mut("task").and_then(|v| v.as_object_mut()) {
                t.remove("stageStartedTick");
            }
        }
    }
}

#[test]
fn frozen_pre_upgrade_v3_recording_replays_with_its_original_single_cue_facts() {
    // Exported from the frozen PR45 (7ec2d79 gameplay) authority before rebuilding.
    let replay =
        Replay::from_json(include_bytes!("../tests/fixtures/v3-action-replay.json")).unwrap();
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    let guard = actor(&mut rebuilt, "guard");
    assert_eq!(guard.action_cue.unwrap().kind, "hit");
    assert!(guard.impact_cue.is_none());
    assert_eq!(guard.motion_distance_milli, 0);
    assert_eq!(guard.last_move_direction, Position { x: 1., y: 1. });
    assert_eq!(replay.timeline().unwrap().frames.last().unwrap().tick, 25);
}
