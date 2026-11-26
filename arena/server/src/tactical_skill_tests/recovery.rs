use super::*;
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

#[test]
fn private_mid_chant_checkpoint_preserves_calls_and_fatal_hit_never_releases() {
    let mut s = setup(ScenarioId::FirstExpedition);
    cast(&mut s, &chant("authored"));
    s.advance();
    let bytes = serde_json::to_vec(&s.checkpoint()).unwrap();
    let mut restored = Session::from_checkpoint(serde_json::from_slice(&bytes).unwrap()).unwrap();
    assert_eq!(
        serde_json::to_value(&s.tactics).unwrap(),
        serde_json::to_value(&restored.tactics).unwrap()
    );
    s.advance();
    restored.advance();
    assert_eq!(s.enemies[0].hp, 64);
    assert_eq!(restored.enemies[0].hp, 64);
    assert_eq!(cast_events(&s, TacticalPhase::Released), 1);
    assert_eq!(cast_events(&restored, TacticalPhase::Released), 1);
    assert_eq!(
        serde_json::to_value(&s.tactics).unwrap(),
        serde_json::to_value(&restored.tactics).unwrap()
    );
    let mut s = setup(ScenarioId::FirstExpedition);
    cast(&mut s, &chant("official"));
    let mut a = actor(&mut s);
    a.hp = 8; // Explicit lethal-boundary fixture, not a live result.
    s.hit_actor(&mut a, "enemy-1", Position { x: -8., y: 8. }, 16, true);
    let e = s
        .world
        .query::<(Entity, &Actor)>()
        .iter(&s.world)
        .find(|(_, a)| a.id == "guard")
        .unwrap()
        .0;
    s.world.entity_mut(e).insert(a);
    s.advance();
    s.advance();
    assert_eq!(actor(&mut s).hp, 0);
    assert_eq!(s.enemies[0].hp, 80);
    assert!(
        s.tactics.as_ref().unwrap().actor_states["guard"]
            .recovery
            .is_none()
    );
    assert_eq!(cast_events(&s, TacticalPhase::Released), 0);
    assert!(s.events.iter().any(|e| {
        e.tactical.as_ref().is_some_and(|t| {
            t.action == TacticalAction::Cast && t.reason_code.as_deref() == Some("actor-downed")
        })
    }));
}

#[test]
fn simultaneous_actor_recovery_events_match_after_checkpoint_entity_reordering() {
    let mut s = setup(ScenarioId::FirstExpedition);
    for state in s.tactics.as_mut().unwrap().actor_states.values_mut() {
        state.recovery = Some(crate::tactics::RecoveryState {
            started_tick: 16,
            rising_tick: 18,
            ends_tick: 20,
        });
    }
    let bytes = serde_json::to_vec(&s.checkpoint()).unwrap();
    let mut restored = Session::from_checkpoint(serde_json::from_slice(&bytes).unwrap()).unwrap();
    for _ in 0..4 {
        s.advance();
        restored.advance();
        assert_eq!(
            serde_json::to_value(s.snapshot()).unwrap(),
            serde_json::to_value(restored.snapshot()).unwrap()
        );
    }
}
