use super::*;
fn same(a: &mut Session, b: &mut Session) {
    fn difference(a: &serde_json::Value, b: &serde_json::Value, path: &str) -> Option<String> {
        match (a, b) {
            (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
                for key in a.keys().chain(b.keys()) {
                    if let Some(d) = difference(
                        &a.get(key).unwrap_or(&serde_json::Value::Null),
                        &b.get(key).unwrap_or(&serde_json::Value::Null),
                        &format!("{path}.{key}"),
                    ) {
                        return Some(d);
                    }
                }
                None
            }
            (serde_json::Value::Array(a), serde_json::Value::Array(b)) if a.len() == b.len() => a
                .iter()
                .zip(b)
                .enumerate()
                .find_map(|(i, (a, b))| difference(a, b, &format!("{path}[{i}]"))),
            _ if a == b => None,
            (serde_json::Value::Number(a), serde_json::Value::Number(b))
                if path.contains(".lastMoveDirection.") =>
            {
                let (a, b) = (a.as_f64().unwrap(), b.as_f64().unwrap());
                // Existing visual direction subtraction may round by one ULP in JSON.
                // All authority coordinates and domain state retain exact comparison.
                if a.is_finite() && b.is_finite() && a.to_bits().abs_diff(b.to_bits()) <= 1 {
                    None
                } else {
                    Some(format!("{path}: {a:?} != {b:?}"))
                }
            }
            _ => Some(format!("{path}: {a} != {b}")),
        }
    }
    assert_eq!(
        serde_json::to_value(&a.tactics).unwrap(),
        serde_json::to_value(&b.tactics).unwrap()
    );
    let a = serde_json::to_value(a.snapshot()).unwrap();
    let b = serde_json::to_value(b.snapshot()).unwrap();
    assert_eq!(difference(&a, &b, "snapshot"), None);
}
fn restored(s: &mut Session) -> Session {
    Session::from_checkpoint(
        serde_json::from_slice(&serde_json::to_vec(&s.checkpoint()).unwrap()).unwrap(),
    )
    .unwrap()
}
#[test]
fn real_commands_claim_midpoint_restart_and_replay_keep_scenario_progress() {
    let mut s = game(Mode::Training);
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-guard".into(),
            room_id: "room-2".into(),
        },
    )
    .unwrap();
    for _ in 0..30 {
        if actor(&mut s, "p1-guard").travel.is_none() {
            break;
        }
        s.advance();
    }
    assert_eq!(actor(&mut s, "p1-guard").room_id, "room-2");
    claim(&mut s, "p1", "p1-guard");
    for _ in 0..3 {
        s.advance();
    }
    assert_eq!(
        s.tactics.as_ref().unwrap().control_points["room-2"].progress_ticks,
        3
    );
    let mut resume = restored(&mut s);
    same(&mut s, &mut resume);
    assert_eq!(resume.tokens["first-token"], "p1");
    for _ in 0..5 {
        s.advance();
        resume.advance();
        same(&mut s, &mut resume);
    }
    assert_eq!(s.rooms[2].owner.as_deref(), Some("p1"));
    let replay = s.export_replay_for(Some("p1")).unwrap();
    assert_eq!(replay.scenario_id, Some(ScenarioId::SealContest));
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    same(&mut s, &mut rebuilt);
    let timeline = replay.timeline().unwrap();
    assert!(
        timeline
            .frames
            .iter()
            .any(|f| f.snapshot.tactics.as_ref().unwrap().control_points[0].progress_ticks == 3)
    );
    s.command("p1", Command::Reset {}).unwrap();
    assert_eq!(s.scenario_id, Some(ScenarioId::SealContest));
    assert_eq!(s.tick, 0);
    assert_eq!(s.rooms[2].owner, None);
    let replay = s.export_replay().unwrap();
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    same(&mut s, &mut rebuilt);
}
#[test]
fn enemy_damage_then_paid_repair_from_only_recorded_commands_replays_exactly() {
    let mut s = game(Mode::Training);
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-scout".into(),
            room_id: "room-3".into(),
        },
    )
    .unwrap();
    for _ in 0..40 {
        if actor(&mut s, "p1-scout").travel.is_none() {
            break;
        }
        s.advance();
    }
    let target = "p1-drill-warehouse";
    let building = s.buildings.iter().find(|b| b.id == target).unwrap();
    assert!(
        building.hp > 0 && building.hp < building.max_hp,
        "facility was actually damaged by PVE while actor travelled"
    );
    let stock = s.players["p1"].materials;
    let mut applied = false;
    for _ in 0..12 {
        repair(&mut s, "p1-scout", target);
        if result(&s).phase == TacticalPhase::Applied {
            applied = true;
            break;
        }
        s.advance();
    }
    assert!(applied, "normal path reached a real repair");
    assert_eq!(s.players["p1"].materials, stock - 1);
    let effect = result(&s);
    assert!(effect.values.hp_after.unwrap() > effect.values.hp_before.unwrap());
    let mut resume = restored(&mut s);
    same(&mut s, &mut resume);
    let replay = s.export_replay().unwrap();
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    same(&mut s, &mut rebuilt);
}
#[test]
fn old_sim7_omits_tactics_and_ordinary_attack_wire_is_byte_compatible() {
    let mut old = Session::new("old".into(), Mode::Training, 42);
    old.join("old-token".into()).unwrap();
    let value = serde_json::to_value(old.snapshot()).unwrap();
    assert!(value.get("scenarioId").is_none());
    assert!(value.get("tactics").is_none());
    let wire = serde_json::json!({"type":"attack","actorId":"p1-guard"});
    let command: Command = serde_json::from_value(wire.clone()).unwrap();
    assert_eq!(serde_json::to_value(command).unwrap(), wire);
    let before = serde_json::to_value(old.checkpoint()).unwrap();
    assert!(
        old.command(
            "p1",
            Command::Claim {
                actor_id: "p1-guard".into(),
                room_id: "room-2".into()
            }
        )
        .is_err()
    );
    assert_eq!(serde_json::to_value(old.checkpoint()).unwrap(), before);
    for _ in 0..5 {
        old.advance();
    }
    let replay = old.export_replay().unwrap();
    assert!(
        serde_json::to_value(&replay)
            .unwrap()
            .get("scenarioId")
            .is_none()
    );
    let mut rebuilt = Session::from_replay(&replay).unwrap();
    same(&mut old, &mut rebuilt);
}
