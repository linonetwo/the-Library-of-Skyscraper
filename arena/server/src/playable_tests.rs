use crate::*;
fn game() -> Session {
    let mut s = Session::new("micro".into(), Mode::Training, 42);
    s.join("token".into()).unwrap();
    s
}
fn task(s: &mut Session, id: &str, kind: &str, target: &str, building: Option<&str>) {
    s.command(
        "p1",
        Command::Task {
            actor_id: format!("p1-{id}"),
            kind: kind.into(),
            target: target.into(),
            building_kind: building.map(str::to_owned),
        },
    )
    .unwrap();
}
fn actor(s: &mut Session, id: &str) -> Actor {
    s.snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == format!("p1-{id}"))
        .unwrap()
}
#[test]
fn distance_controls_arrival_and_interaction() {
    for (target, ticks) in [("room-1", 11), ("room-3", 22)] {
        let mut s = game();
        s.command(
            "p1",
            Command::Move {
                actor_id: "p1-gatherer".into(),
                room_id: target.into(),
            },
        )
        .unwrap();
        for _ in 0..ticks - 1 {
            s.advance();
            assert_eq!(actor(&mut s, "gatherer").room_id, "room-0");
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
        s.advance();
        assert_eq!(actor(&mut s, "gatherer").room_id, target);
        assert!(actor(&mut s, "gatherer").travel.is_none());
    }
}
#[test]
fn gather_transport_and_construction_really_consume_time() {
    let mut s = game();
    task(&mut s, "gatherer", "gather", "room-1", None);
    task(&mut s, "scout", "build", "room-3", Some("catalog"));
    task(&mut s, "guard", "guard", "room-3", None);
    for _ in 0..200 {
        s.advance();
    }
    assert!(s.scenario.report.materials_delivered >= 24);
    assert_eq!(s.scenario.report.materials_spent, 25);
    assert!(
        s.buildings
            .iter()
            .any(|b| b.kind == "catalog" && b.construction_ticks == 16)
    );
    assert!(s.enemies[0].hp == 0);
}
#[test]
fn conservative_strategy_wins_counterattack_and_same_seed_retry() {
    let mut s = game();
    task(&mut s, "gatherer", "gather", "room-1", None);
    task(&mut s, "guard", "guard", "room-3", None);
    task(&mut s, "scout", "build", "room-3", Some("catalog"));
    for _ in 0..960 {
        if s.result.is_some() {
            break;
        }
        s.advance();
    }
    assert_eq!(
        s.result.as_ref().map(|r| r.winner.clone()),
        Some("p1".into()),
        "{}",
        serde_json::to_string(&s.snapshot()).unwrap()
    );
    assert!(s.scenario.counterattack_spawned);
    let replay = s.export_replay().unwrap();
    Session::from_replay(&replay).unwrap();
    let restored = Session::from_checkpoint(s.checkpoint()).unwrap();
    assert!(restored.scenario.counterattack_spawned);
    s.command("p1", Command::Reset {}).unwrap();
    assert_eq!(s.seed, 42);
    assert_eq!(s.tick, 0);
    assert_eq!(s.players["p1"].materials, 10);
}
#[test]
fn no_catalog_strategy_loses_at_eight_minutes() {
    let mut s = game();
    for _ in 0..960 {
        s.advance();
    }
    assert_eq!(s.result.as_ref().unwrap().winner, "");
    assert!(s.result.as_ref().unwrap().reason.contains("8分钟"));
    let tick = s.tick;
    s.advance();
    assert_eq!(tick, s.tick);
    Session::from_replay(&s.export_replay().unwrap()).unwrap();
}
#[test]
fn zero_retreat_guard_is_permanently_downed_and_cargo_lost() {
    let mut s = game();
    s.players.get_mut("p1").unwrap().rule.retreat_hp = 0;
    task(&mut s, "guard", "guard", "room-3", None);
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.hp = 8;
    a.cargo = 4;
    a.room_id = "room-3".into();
    a.world_position = crate::travel::center("room-3");
    a.task = None;
    s.world.entity_mut(e).insert(a);
    for _ in 0..80 {
        s.advance();
    }
    assert_eq!(actor(&mut s, "guard").hp, 0);
    assert_eq!(s.scenario.report.cargo_lost, 4);
    let p = actor(&mut s, "guard").world_position;
    for _ in 0..20 {
        s.advance();
    }
    assert_eq!(actor(&mut s, "guard").world_position, p);
}
#[test]
fn retreat_uses_real_path_then_recovers_only_at_base() {
    let mut s = game();
    task(&mut s, "guard", "guard", "room-3", None);
    for _ in 0..24 {
        s.advance();
    }
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.hp = 32;
    s.world.entity_mut(e).insert(a);
    s.advance();
    assert!(actor(&mut s, "guard").retreating);
    assert_eq!(actor(&mut s, "guard").room_id, "room-3");
    let hp = actor(&mut s, "guard").hp;
    for _ in 0..10 {
        s.advance();
    }
    assert!(actor(&mut s, "guard").hp <= hp);
    let mut recovered_at_base = false;
    for _ in 0..100 {
        s.advance();
        let a = actor(&mut s, "guard");
        if a.room_id == "room-0" && a.travel.is_none() && a.hp >= 80 {
            recovered_at_base = true;
            break;
        }
    }
    assert!(
        recovered_at_base,
        "{}",
        serde_json::to_string(&s.snapshot()).unwrap()
    );
}
#[test]
fn checkpoint_and_replay_preserve_mid_route_position() {
    let mut s = game();
    task(&mut s, "gatherer", "gather", "room-1", None);
    for _ in 0..7 {
        s.advance();
    }
    let snapshot = serde_json::to_value(s.snapshot()).unwrap();
    let mut resumed = Session::from_checkpoint(s.checkpoint()).unwrap();
    assert_eq!(snapshot, serde_json::to_value(resumed.snapshot()).unwrap());
    let mut replayed = Session::from_replay(&s.export_replay().unwrap()).unwrap();
    for _ in 0..20 {
        s.advance();
        resumed.advance();
        replayed.advance();
    }
    assert_eq!(
        serde_json::to_value(s.snapshot()).unwrap(),
        serde_json::to_value(resumed.snapshot()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(s.snapshot()).unwrap(),
        serde_json::to_value(replayed.snapshot()).unwrap()
    );
}

#[test]
fn counterattack_survives_a_downed_first_actor_and_is_persisted_once() {
    let mut s = game();
    let (e, mut a) = s.owned_actor("p1", "p1-scout").unwrap();
    a.hp = 0;
    s.world.entity_mut(e).insert(a);
    s.scenario.catalog_progress = 30;
    s.scenario.counterattack_tick = Some(1);
    s.advance();
    assert!(s.scenario.counterattack_spawned);
    let mut resumed = Session::from_checkpoint(s.checkpoint()).unwrap();
    for _ in 0..30 {
        resumed.advance();
    }
    assert_eq!(
        resumed
            .enemies
            .iter()
            .filter(|e| e.id == "guardian-counterattack")
            .count(),
        1
    );
    let enemy = resumed
        .enemies
        .iter()
        .find(|e| e.id == "guardian-counterattack")
        .unwrap();
    assert_eq!(enemy.room_id, "room-3");
    assert!(enemy.travel.is_none());
}
#[test]
fn missing_old_checkpoint_position_migrates_to_room_center() {
    let mut s = Session::new_legacy("old".into(), Mode::Training, 42);
    s.join("token".into()).unwrap();
    s.advance();
    let mut checkpoint = serde_json::to_value(s.checkpoint()).unwrap();
    for actor in checkpoint["snapshot"]["actors"].as_array_mut().unwrap() {
        actor.as_object_mut().unwrap().remove("worldPosition");
        actor.as_object_mut().unwrap().remove("travel");
    }
    let save: SessionCheckpoint = serde_json::from_value(checkpoint).unwrap();
    let mut restored = Session::from_checkpoint(save).unwrap();
    for a in restored.snapshot().actors {
        assert_eq!(a.world_position, crate::travel::center(&a.room_id));
        assert!(a.travel.is_none());
    }
}
#[test]
fn actual_old_replay_without_version_geometry_or_task_fields_still_reproduces() {
    let mut s = Session::new_legacy("old-replay".into(), Mode::Training, 42);
    s.join("token".into()).unwrap();
    for _ in 0..120 {
        s.advance();
    }
    let mut json = serde_json::to_value(s.export_replay().unwrap()).unwrap();
    json.as_object_mut().unwrap().remove("simulationVersion");
    json.as_object_mut().unwrap().remove("mapVersion");
    let snapshot = &mut json["finalSnapshot"];
    for key in [
        "simulationVersion",
        "mapVersion",
        "tickDurationMs",
        "worldMap",
        "scenarioConfig",
        "scenario",
        "enemies",
    ] {
        snapshot.as_object_mut().unwrap().remove(key);
    }
    for actor in snapshot["actors"].as_array_mut().unwrap() {
        for key in [
            "worldPosition",
            "travel",
            "task",
            "actionTick",
            "retreating",
        ] {
            actor.as_object_mut().unwrap().remove(key);
        }
    }
    for b in snapshot["buildings"].as_array_mut().unwrap() {
        for key in ["hp", "maxHp", "constructionTicks", "requiredTicks"] {
            b.as_object_mut().unwrap().remove(key);
        }
    }
    let replay = Replay::from_json(&serde_json::to_vec(&json).unwrap()).unwrap();
    let restored = Session::from_replay(&replay).unwrap();
    assert_eq!(restored.tick, 120);
    assert!(restored.result.is_some());
}

#[test]
fn script_wait_holds_fire_manual_conflicts_and_attack_uses_one_cooldown() {
    let mut s = game();
    s.players.get_mut("p1").unwrap().script = Some(ScriptMetadata {
        source_hash: "wait".into(),
        entry: "main.ts".into(),
        published_at_tick: 0,
    });
    let (e, mut a) = s.owned_actor("p1", "p1-guard").unwrap();
    a.room_id = "room-3".into();
    a.world_position = crate::travel::center("room-3");
    s.world.entity_mut(e).insert(a);
    for _ in 0..8 {
        s.advance_scripted(vec![]);
    }
    assert_eq!(
        s.enemies[0].hp, 80,
        "empty script decision must not attack autonomously"
    );
    assert!(
        s.command(
            "p1",
            Command::Task {
                actor_id: "p1-guard".into(),
                kind: "guard".into(),
                target: "room-3".into(),
                building_kind: None
            }
        )
        .unwrap_err()
        .contains("TypeScript")
    );
    s.apply_command(
        "p1",
        Command::Attack {
            actor_id: "p1-guard".into(),
        },
    )
    .unwrap();
    assert_eq!(s.enemies[0].hp, 68);
    assert!(
        s.apply_command(
            "p1",
            Command::Attack {
                actor_id: "p1-guard".into()
            }
        )
        .is_err()
    );
    s.advance_scripted(vec![]);
    assert_eq!(s.enemies[0].hp, 68);
}

#[test]
fn restored_old_checkpoint_continues_export_and_timeline_consistently() {
    let mut s = Session::new_legacy("old-chain".into(), Mode::Training, 42);
    s.join("token".into()).unwrap();
    for _ in 0..10 {
        s.advance();
    }
    let mut checkpoint = serde_json::to_value(s.checkpoint()).unwrap();
    for a in checkpoint["snapshot"]["actors"].as_array_mut().unwrap() {
        a.as_object_mut().unwrap().remove("worldPosition");
    }
    let mut restored =
        Session::from_checkpoint(serde_json::from_value(checkpoint).unwrap()).unwrap();
    for _ in 0..10 {
        restored.advance();
    }
    let replay = restored.export_replay().unwrap();
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    assert_eq!(
        serde_json::to_value(restored.snapshot()).unwrap(),
        serde_json::to_value(rebuilt.snapshot()).unwrap()
    );
    let timeline = replay.timeline().unwrap();
    assert_eq!(
        serde_json::to_value(timeline.frames.last().unwrap().snapshot.clone()).unwrap(),
        serde_json::to_value(restored.snapshot()).unwrap()
    );
}
#[test]
fn script_build_uses_specified_second_actor_and_preserves_first_task() {
    let mut s = game();
    s.players.get_mut("p1").unwrap().materials = 100;
    task(&mut s, "gatherer", "gather", "room-1", None);
    s.advance_scripted(vec![ScriptDecision {
        player_id: "p1".into(),
        source_hash: None,
        memory_patch: None,
        task_patches: None,
        failure: None,
        intents: vec![ScriptIntent {
            actor_id: "p1-scout".into(),
            priority: 10.,
            action: ScriptAction::Build {
                room_id: "room-0".into(),
                kind: "tower".into(),
            },
        }],
    }]);
    assert_eq!(actor(&mut s, "scout").task.unwrap().kind, "build");
    assert_eq!(actor(&mut s, "gatherer").task.unwrap().kind, "gather");
}

#[test]
fn four_owners_have_twelve_distinct_legal_birth_slots() {
    let mut s = Session::new("four".into(), Mode::Online, 42);
    for i in 0..4 {
        s.join(format!("token-{i}")).unwrap();
    }
    let actors = s.snapshot().actors;
    assert_eq!(actors.len(), 12);
    for (i, a) in actors.iter().enumerate() {
        assert!(a.world_position.x.abs() <= 2.5 && a.world_position.y.abs() <= 2.5);
        for b in &actors[i + 1..] {
            assert!(
                crate::travel::distance(a.world_position, b.world_position) >= 1000,
                "{} overlaps {}",
                a.id,
                b.id
            );
        }
    }
}

#[test]
fn explicit_props_clear_roads_slots_and_central_interaction_space() {
    let map = crate::travel::world_map();
    for prop in map["props"].as_array().unwrap() {
        let p: Position = serde_json::from_value(prop["position"].clone()).unwrap();
        let half_x = prop["footprint"]["width"].as_f64().unwrap() / 2.;
        let half_y = prop["footprint"]["depth"].as_f64().unwrap() / 2.;
        let room = prop["roomId"].as_str().unwrap();
        let c = crate::travel::center(room);
        let half = map["rooms"]
            .as_array()
            .unwrap()
            .iter()
            .find(|r| r["id"] == room)
            .unwrap()["floorHalfSize"]
            .as_f64()
            .unwrap();
        assert!((p.x - c.x).abs() + half_x <= half && (p.y - c.y).abs() + half_y <= half);
        assert!(
            (p.x - c.x).abs() - half_x >= 1.5 || (p.y - c.y).abs() - half_y >= 1.5,
            "central interaction overlap {prop}"
        );
        for owner in ["p1", "p2", "p3", "p4"] {
            for role in ["gatherer", "guard", "scout"] {
                let slot = crate::travel::slot(room, role, owner);
                assert!(
                    (p.x - slot.x).abs() > half_x || (p.y - slot.y).abs() > half_y,
                    "slot overlap {prop}"
                );
            }
        }
        for link in map["links"].as_array().unwrap() {
            let points: Vec<Position> = serde_json::from_value(link["points"].clone()).unwrap();
            for w in points.windows(2) {
                assert!(w[0].x == w[1].x || w[0].y == w[1].y);
                let left = w[0].x.min(w[1].x) - 1.5;
                let right = w[0].x.max(w[1].x) + 1.5;
                let top = w[0].y.min(w[1].y) - 1.5;
                let bottom = w[0].y.max(w[1].y) + 1.5;
                assert!(
                    p.x + half_x <= left
                        || p.x - half_x >= right
                        || p.y + half_y <= top
                        || p.y - half_y >= bottom,
                    "road overlap {prop}"
                );
            }
        }
    }
}

#[test]
fn tower_and_enemy_use_building_anchor_for_range_and_attack() {
    let mut s = game();
    s.players.get_mut("p1").unwrap().materials = 100;
    s.ensure_site("p1", "room-1", "tower").unwrap();
    let idx = s.buildings.iter().position(|b| b.kind == "tower").unwrap();
    s.buildings[idx].construction_ticks = s.buildings[idx].required_ticks;
    let anchor = s.buildings[idx].world_position;
    assert_eq!(anchor, crate::travel::build_anchor("room-1", "tower"));
    s.enemies[0].room_id = "room-1".into();
    s.enemies[0].world_position = Position {
        x: anchor.x + 4.001,
        y: anchor.y,
    };
    s.enemies[0].travel = Some(Travel {
        travel_id: "range-test".into(),
        target_room_id: "room-1".into(),
        path: vec![s.enemies[0].world_position, anchor],
        segment: 0,
        distance_milli: 0,
        total_distance_milli: 4001,
        started_tick: 0,
        speed_milli_per_tick: 750,
        progress: 0.,
    });
    s.tick = 4;
    s.combat_tick();
    assert_eq!(s.enemies[0].hp, 80);
    s.enemies[0].world_position = Position {
        x: anchor.x + 4.,
        y: anchor.y,
    };
    s.tick = 8;
    s.combat_tick();
    assert_eq!(s.enemies[0].hp, 74);
    s.enemies[0].world_position = Position {
        x: anchor.x + 1.9,
        y: anchor.y,
    };
    s.enemies[0].travel = None;
    s.tick = 13;
    s.combat_tick();
    assert_eq!(s.buildings[idx].hp, 112);
    assert_eq!(s.enemies[0].action_cue.as_ref().unwrap().kind, "attack");
    assert_eq!(
        s.enemies[0].action_cue.as_ref().unwrap().target_position,
        Some(anchor)
    );
}

#[test]
fn presets_assign_real_distinct_tasks_threshold_preserves_and_disable_restores() {
    let mut s = game();
    s.command(
        "p1",
        Command::Rule {
            preset: "gather".into(),
            retreat_hp: 35,
            assign_tasks: true,
        },
    )
    .unwrap();
    assert_eq!(actor(&mut s, "gatherer").task.unwrap().target, "room-1");
    assert_eq!(actor(&mut s, "scout").task.unwrap().kind, "build");
    for _ in 0..4 {
        s.advance();
    }
    let travel_id = actor(&mut s, "gatherer").travel.unwrap().travel_id;
    s.command(
        "p1",
        Command::Rule {
            preset: "gather".into(),
            retreat_hp: 50,
            assign_tasks: false,
        },
    )
    .unwrap();
    assert_eq!(
        actor(&mut s, "gatherer").travel.unwrap().travel_id,
        travel_id
    );
    s.command(
        "p1",
        Command::Rule {
            preset: "explore".into(),
            retreat_hp: 35,
            assign_tasks: true,
        },
    )
    .unwrap();
    assert_eq!(actor(&mut s, "gatherer").task.unwrap().target, "room-4");
    assert_eq!(actor(&mut s, "scout").task.unwrap().target, "room-6");
    let metadata = ScriptMetadata {
        source_hash: "wait".into(),
        entry: "main.ts".into(),
        published_at_tick: s.tick,
    };
    s.set_script_metadata("p1", Some(metadata));
    assert!(actor(&mut s, "gatherer").task.is_none());
    s.command(
        "p1",
        Command::Rule {
            preset: "defend".into(),
            retreat_hp: 60,
            assign_tasks: false,
        },
    )
    .unwrap();
    assert!(s.players["p1"].script.is_some());
    assert!(actor(&mut s, "gatherer").task.is_none());
    s.disable_script("p1");
    for a in s.snapshot().actors {
        let t = a.task.unwrap();
        assert_eq!(t.target, "room-0");
        assert_eq!(t.kind, "guard");
    }
}
#[test]
fn warehouse_deposit_requires_world_distance_and_cue_matches_anchor() {
    let mut s = game();
    let (_, mut a) = s.owned_actor("p1", "p1-gatherer").unwrap();
    a.cargo = 4;
    a.world_position = Position { x: -2., y: 2. };
    let before = s.players["p1"].materials;
    assert!(s.deposit(&mut a).is_err());
    assert_eq!(s.players["p1"].materials, before);
    let anchor = crate::travel::build_anchor("room-0", "warehouse");
    a.world_position = anchor;
    s.deposit(&mut a).unwrap();
    assert_eq!(s.players["p1"].materials, before + 4);
    let cue = a.action_cue.unwrap();
    assert_eq!(cue.kind, "deliver");
    assert_eq!(cue.target_position, Some(anchor));
}

#[test]
fn repeated_deliver_commands_queue_one_tick_budget_and_then_deposit() {
    let mut s = game();
    let (e, mut a) = s.owned_actor("p1", "p1-gatherer").unwrap();
    a.cargo = 4;
    a.world_position = Position { x: -2., y: 2. };
    s.world.entity_mut(e).insert(a);
    let initial = actor(&mut s, "gatherer").world_position;
    for _ in 0..20 {
        s.command(
            "p1",
            Command::Deliver {
                actor_id: "p1-gatherer".into(),
            },
        )
        .unwrap();
    }
    assert_eq!(actor(&mut s, "gatherer").world_position, initial);
    assert_eq!(s.players["p1"].materials, 10);
    let mut previous = initial;
    for _ in 0..20 {
        s.advance();
        let a = actor(&mut s, "gatherer");
        assert!(crate::travel::distance(previous, a.world_position) <= 751);
        previous = a.world_position;
        if a.cargo == 0 {
            break;
        }
    }
    assert_eq!(actor(&mut s, "gatherer").cargo, 0);
    assert_eq!(s.players["p1"].materials, 14);
}
#[test]
fn road_arrival_and_room_approach_share_one_movement_budget() {
    let mut s = game();
    task(&mut s, "scout", "build", "room-3", Some("catalog"));
    task(&mut s, "guard", "guard", "room-3", None);
    let mut previous = s.snapshot().actors;
    for _ in 0..50 {
        s.advance();
        let current = s.snapshot().actors;
        for a in &current {
            let old = previous.iter().find(|b| b.id == a.id).unwrap();
            assert!(
                crate::travel::distance(old.world_position, a.world_position) <= 751,
                "{} moved too far",
                a.id
            );
        }
        previous = current;
    }
}
