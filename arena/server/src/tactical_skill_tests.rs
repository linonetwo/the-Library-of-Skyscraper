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

mod casting;
mod recovery;
