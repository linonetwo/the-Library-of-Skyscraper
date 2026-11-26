//! Explicit unit worlds consume recorded native-worker responses; these are not live-game evidence.
use crate::*;
use bevy_ecs::prelude::Entity;
fn response(name: &str) -> serde_json::Value {
    let data: serde_json::Value = serde_json::from_str(include_str!(
        "../tests/fixtures/chant-worker-responses.json"
    ))
    .unwrap();
    data["fixtures"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["name"] == name)
        .unwrap()["response"]
        .clone()
}
fn chant(name: &str) -> ChantRecord {
    serde_json::from_value(response(name)["chants"][0].clone()).unwrap()
}
fn setup(scenario: ScenarioId) -> Session {
    let mut s = Session::new_scenario("skill-unit".into(), Mode::Training, 42, scenario);
    s.join("owner-secret".into()).unwrap();
    s.tick = 17;
    let entity = s
        .world
        .query::<(Entity, &Actor)>()
        .iter(&s.world)
        .find(|(_, a)| a.id == "p1-guard")
        .unwrap()
        .0;
    let mut actor = s.world.get_mut::<Actor>(entity).unwrap();
    actor.id = "guard".into();
    actor.room_id = "room-3".into();
    actor.world_position = Position { x: -8., y: 6.2 };
    let state = s
        .tactics
        .as_mut()
        .unwrap()
        .actor_states
        .remove("p1-guard")
        .unwrap();
    s.tactics
        .as_mut()
        .unwrap()
        .actor_states
        .insert("guard".into(), state);
    s.enemies[0].id = "enemy-1".into();
    s.enemies[0].room_id = "room-3".into();
    s.enemies[0].world_position = Position { x: -8., y: 8. };
    s.enemies[0].hp = 80;
    s.enemies[0].max_hp = 80;
    for enemy in s.enemies.iter_mut().skip(1) {
        enemy.hp = 0;
    }
    s.set_script_metadata(
        "p1",
        Some(ScriptMetadata {
            source_hash: "rule-A".into(),
            entry: "main.ts".into(),
            published_at_tick: 17,
        }),
    );
    s
}
fn actor(s: &mut Session) -> Actor {
    s.snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == "guard")
        .unwrap()
}
fn cast(s: &mut Session, record: &ChantRecord) {
    s.start_cast(
        "p1",
        "guard",
        SkillId::InkStrike,
        "enemy-1",
        &RecordedChant::Worker(record.clone()),
        record.intent_index,
    )
    .unwrap();
}
fn cast_events(s: &Session, phase: TacticalPhase) -> usize {
    s.events
        .iter()
        .filter(|e| {
            e.tactical
                .as_ref()
                .is_some_and(|t| t.action == TacticalAction::Cast && t.phase == phase)
        })
        .count()
}
#[test]
fn actual_worker_outer_records_bind_original_index_and_match_only_real_steps() {
    for name in ["official", "authored"] {
        let record = chant(name);
        assert!(record.is_bound(1, "guard", "enemy-1", 17));
        assert!(!record.is_bound(0, "guard", "enemy-1", 17));
        assert!(!record.is_bound(1, "guard", "different", 17));
        assert_eq!(record.failure(), None);
    }
    assert_eq!(chant("missing-seal").failure(), Some("chant-mismatch"));
    let forged: ScriptDecision=serde_json::from_value(serde_json::json!({"playerId":"p1","intents":[],"memoryPatch":{"set":{"chants":response("official")["chants"]}}})).unwrap();
    assert!(
        forged.chants.is_none(),
        "a player memory value is not the worker sidechannel"
    );
}
#[test]
fn two_tick_release_once_locks_authored_version_and_recovers_energy_at_eight() {
    let mut s = setup(ScenarioId::FirstExpedition);
    let record = chant("authored");
    cast(&mut s, &record);
    assert_eq!(s.tactics.as_ref().unwrap().actor_states["guard"].energy, 2);
    assert_eq!(
        s.tactics.as_ref().unwrap().actor_states["guard"].cast_ready_tick,
        25
    );
    s.set_script_metadata(
        "p1",
        Some(ScriptMetadata {
            source_hash: "rule-B".into(),
            entry: "main.ts".into(),
            published_at_tick: 17,
        }),
    );
    assert_eq!(
        s.tactics.as_ref().unwrap().actor_states["guard"]
            .cast
            .as_ref()
            .unwrap()
            .source_hash,
        record.skill_source_hash
    );
    s.advance();
    assert_eq!(s.enemies[0].hp, 80);
    assert_eq!(
        s.snapshot()
            .tactics
            .unwrap()
            .actor_states
            .iter()
            .find(|a| a.actor_id == "guard")
            .unwrap()
            .cast
            .as_ref()
            .unwrap()
            .phase,
        CastPhase::Chanting
    );
    s.advance();
    assert_eq!(s.enemies[0].hp, 64);
    assert_eq!(cast_events(&s, TacticalPhase::Released), 1);
    s.advance();
    assert_eq!(s.enemies[0].hp, 64);
    assert_eq!(
        s.snapshot()
            .tactics
            .unwrap()
            .actor_states
            .iter()
            .find(|a| a.actor_id == "guard")
            .unwrap()
            .cast
            .as_ref()
            .unwrap()
            .phase,
        CastPhase::Recovery
    );
    s.advance();
    assert!(s.tactical_block("guard").is_none());
    assert_eq!(s.tactics.as_ref().unwrap().actor_states["guard"].energy, 2);
    for _ in 0..4 {
        s.advance();
    }
    assert_eq!(s.tick, 25);
    assert_eq!(s.tactics.as_ref().unwrap().actor_states["guard"].energy, 3);
    assert_eq!(cast_events(&s, TacticalPhase::Released), 1);
}
#[test]
fn missing_seal_spends_energy_but_never_damages_and_target_loss_is_explicit() {
    let mut s = setup(ScenarioId::FirstExpedition);
    cast(&mut s, &chant("missing-seal"));
    s.advance();
    s.advance();
    assert_eq!(s.enemies[0].hp, 80);
    assert_eq!(s.tactics.as_ref().unwrap().actor_states["guard"].energy, 2);
    assert!(s.events.iter().any(|e| {
        e.tactical
            .as_ref()
            .is_some_and(|t| t.reason_code.as_deref() == Some("chant-mismatch"))
    }));
    let mut s = setup(ScenarioId::FirstExpedition);
    cast(&mut s, &chant("official"));
    s.enemies[0].world_position = Position { x: -8., y: 11. };
    s.advance();
    s.advance();
    assert_eq!(s.enemies[0].hp, 80);
    assert!(s.events.iter().any(|e| {
        e.tactical.as_ref().is_some_and(|t| {
            t.action == TacticalAction::Cast && t.reason_code.as_deref() == Some("out-of-range")
        })
    }));
}
#[test]
fn unarmed_and_wrong_window_do_not_charge_and_active_cast_locks_only_weapon() {
    let mut s = setup(ScenarioId::FirstExpedition);
    let e = s
        .world
        .query::<(Entity, &Actor)>()
        .iter(&s.world)
        .find(|(_, a)| a.id == "guard")
        .unwrap()
        .0;
    s.world.get_mut::<Actor>(e).unwrap().appearance.weapon = false;
    cast(&mut s, &chant("official"));
    assert_eq!(s.tactics.as_ref().unwrap().actor_states["guard"].energy, 3);
    assert_eq!(
        s.events
            .last()
            .unwrap()
            .tactical
            .as_ref()
            .unwrap()
            .reason_code
            .as_deref(),
        Some("staff-required")
    );
    s.world.get_mut::<Actor>(e).unwrap().appearance.weapon = true;
    s.tick += 1;
    cast(&mut s, &chant("official"));
    assert_eq!(s.tactics.as_ref().unwrap().actor_states["guard"].energy, 3);
    assert_eq!(
        s.events
            .last()
            .unwrap()
            .tactical
            .as_ref()
            .unwrap()
            .reason_code
            .as_deref(),
        Some("chant-context-mismatch")
    );
    s.tick += 1;
    let mut record = chant("official");
    record.observed_tick = s.tick;
    cast(&mut s, &record);
    let mut appearance = actor(&mut s).appearance;
    appearance.weapon = false;
    assert!(
        s.command(
            "p1",
            Command::Equip {
                actor_id: "guard".into(),
                appearance
            }
        )
        .is_err()
    );
    appearance.weapon = true;
    appearance.hair = Hair::Midnight;
    s.command(
        "p1",
        Command::Equip {
            actor_id: "guard".into(),
            appearance,
        },
    )
    .unwrap();
    assert_eq!(actor(&mut s).appearance.hair, Hair::Midnight);
    assert!(
        s.apply_command(
            "p1",
            Command::Move {
                actor_id: "guard".into(),
                room_id: "room-0".into()
            }
        )
        .is_err()
    );
}
#[test]
fn heavy_release_precedes_cast_same_tick_and_nonlethal_recovery_keeps_boundary() {
    let mut s = setup(ScenarioId::SealContest);
    s.tick = 7;
    let mut record = chant("official");
    record.observed_tick = 7;
    cast(&mut s, &record);
    s.advance();
    assert!(s.events.iter().any(|e| {
        e.tactical.as_ref().is_some_and(|t| {
            t.action == TacticalAction::Heavy && t.phase == TacticalPhase::Telegraph
        })
    }));
    s.advance();
    assert_eq!(s.tick, 9);
    assert_eq!(s.enemies[0].hp, 80);
    assert_eq!(cast_events(&s, TacticalPhase::Interrupted), 1);
    assert_eq!(cast_events(&s, TacticalPhase::Released), 0);
    let hp = actor(&mut s).hp;
    assert!(hp > 0);
    let boundary = s.tactics.as_ref().unwrap().actor_states["guard"]
        .recovery
        .clone()
        .unwrap();
    assert_eq!(
        (
            boundary.started_tick,
            boundary.rising_tick,
            boundary.ends_tick
        ),
        (9, 11, 13)
    );
    s.advance();
    assert_eq!(actor(&mut s).state, "downed");
    s.advance();
    assert_eq!(actor(&mut s).state, "rising");
    let mut a = actor(&mut s);
    s.hit_actor(&mut a, "enemy-1", Position { x: -8., y: 8. }, 1, true);
    let e = s
        .world
        .query::<(Entity, &Actor)>()
        .iter(&s.world)
        .find(|(_, a)| a.id == "guard")
        .unwrap()
        .0;
    s.world.entity_mut(e).insert(a);
    assert_eq!(
        s.tactics.as_ref().unwrap().actor_states["guard"]
            .recovery
            .as_ref()
            .unwrap()
            .ends_tick,
        13
    );
    s.advance();
    s.advance();
    assert!(s.tactical_block("guard").is_none());
    assert!(actor(&mut s).hp > 0);
}
