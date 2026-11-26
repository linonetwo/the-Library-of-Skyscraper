use super::*;
#[test]
fn explicit_focus_hits_only_b_and_records_later_target_gone() {
    let mut s = game(Mode::Training);
    assert_eq!(
        s.snapshot().scenario_config["attack"]["rangeMilli"],
        crate::scenario::number("attackRange") * 1000
    );
    s.tick = 4;
    place(&mut s, "p1-guard", "room-3", -8., 6.2);
    place(&mut s, "p1-scout", "room-3", -8.1, 6.2);
    s.enemies[1].hp = 4; // Deliberate lethal-boundary unit fixture, not claimed live evidence.
    let position = actor(&mut s, "p1-guard").world_position;
    assert!(
        s.enemies
            .iter()
            .all(|e| crate::travel::distance(position, e.world_position) <= 2000)
    );
    let a_hp = s.enemies[0].hp;
    attack(&mut s, "p1-guard", "drill-guardian-b");
    assert_eq!(s.enemies[1].hp, 0);
    assert_eq!(s.enemies[0].hp, a_hp);
    assert_eq!(result(&s).phase, TacticalPhase::Applied);
    attack(&mut s, "p1-scout", "drill-guardian-b");
    assert_eq!(result(&s).reason_code.as_deref(), Some("target-gone"));
    assert_eq!(s.enemies[0].hp, a_hp);
    attack(&mut s, "p1-guard", "drill-guardian-a");
    assert_eq!(
        result(&s).reason_code.as_deref(),
        Some("actor-already-acted")
    );
    assert_eq!(s.enemies[0].hp, a_hp);
}
#[test]
fn approach_has_one_budget_no_damage_and_no_automatic_retarget() {
    let mut s = game(Mode::Training);
    s.tick = 4;
    place(&mut s, "p1-guard", "room-3", -8., 5.1);
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
    let start = actor(&mut s, "p1-guard");
    let hp: Vec<_> = s.enemies.iter().map(|e| e.hp).collect();
    attack(&mut s, "p1-guard", "drill-guardian-b");
    let after = actor(&mut s, "p1-guard");
    assert_eq!(result(&s).phase, TacticalPhase::Approaching);
    assert!(crate::travel::distance(start.world_position, after.world_position) <= 750);
    assert_eq!(after.action_tick, start.action_tick);
    assert_eq!(s.enemies.iter().map(|e| e.hp).collect::<Vec<_>>(), hp);
    attack(&mut s, "p1-guard", "drill-guardian-a");
    assert_eq!(
        actor(&mut s, "p1-guard").world_position,
        after.world_position
    );
    assert_eq!(
        s.tactics.as_ref().unwrap().actor_states["p1-guard"]
            .attack_target_id
            .as_deref(),
        Some("drill-guardian-b")
    );
    for command in [
        Command::Repair {
            actor_id: "p1-guard".into(),
            building_id: "p1-drill-warehouse".into(),
        },
        Command::Claim {
            actor_id: "p1-guard".into(),
            room_id: "room-2".into(),
        },
    ] {
        s.command("p1", command).unwrap();
        assert_eq!(
            result(&s).reason_code.as_deref(),
            Some("actor-already-acted")
        );
        assert_eq!(
            s.tactics.as_ref().unwrap().actor_states["p1-guard"]
                .attack_target_id
                .as_deref(),
            Some("drill-guardian-b")
        );
    }
    s.advance();
    assert_eq!(
        actor(&mut s, "p1-guard").world_position,
        after.world_position,
        "rejected repair/claim preserve explicit B and cannot reactivate guard pursuit of A"
    );
}
#[test]
fn unauthorized_attack_never_adds_an_operation_or_event() {
    let mut s = game(Mode::Online);
    let before = serde_json::to_value(s.checkpoint()).unwrap();
    assert!(
        s.command(
            "p2",
            Command::Attack {
                actor_id: "p1-guard".into(),
                target_id: Some("drill-guardian-b".into())
            }
        )
        .is_err()
    );
    assert_eq!(serde_json::to_value(s.checkpoint()).unwrap(), before);
}

#[test]
fn ordinary_attack_also_consumes_the_sim8_action_slot() {
    let mut s = game(Mode::Training);
    s.tick = 4;
    place(&mut s, "p1-guard", "room-3", -8., 8.);
    let index = s
        .buildings
        .iter()
        .position(|b| b.id == "p1-drill-warehouse")
        .unwrap();
    s.buildings[index].hp = 70;
    let stock = s.players["p1"].materials;
    s.command(
        "p1",
        Command::Attack {
            actor_id: "p1-guard".into(),
            target_id: None,
        },
    )
    .unwrap();
    repair(&mut s, "p1-guard", "p1-drill-warehouse");
    assert_eq!(
        result(&s).reason_code.as_deref(),
        Some("actor-already-acted")
    );
    assert_eq!(s.buildings[index].hp, 70);
    assert_eq!(s.players["p1"].materials, stock);
}

#[test]
fn script_world_rejection_uses_one_existing_rejection_event() {
    let mut s = game(Mode::Training);
    // Metadata-only unit invocation: no claim of compiler or worker execution.
    s.publish_script(
        "p1",
        PublishedScript {
            project: SourceProject {
                files: std::collections::BTreeMap::from([("main.ts".into(), "fixture".into())]),
                entry: None,
            },
            bundle: serde_json::json!({"sourceHash":"fixture","entry":"main.ts","code":"fixture"}),
        },
    );
    s.advance_scripted(vec![ScriptDecision {
        chants: None,
source_hash: None, memory_patch: None, task_patches: None,
        player_id: "p1".into(), failure: None,
        intents: serde_json::from_value(serde_json::json!([{"type":"attack","actorId":"p1-guard","targetId":"gone","priority":50}])).unwrap(),
    }]);
    let rejections: Vec<_> = s
        .events
        .iter()
        .filter(|e| e.kind == "script-rejected")
        .collect();
    assert_eq!(rejections.len(), 1);
    assert_eq!(
        rejections[0]
            .tactical
            .as_ref()
            .unwrap()
            .reason_code
            .as_deref(),
        Some("target-gone")
    );
    assert!(s.enemies.iter().all(|e| e.hp == 80));
}
