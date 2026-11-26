use super::*;
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
    let mut cooldown_input = record.clone();
    cooldown_input.observed_tick = s.tick;
    cast(&mut s, &cooldown_input);
    assert_eq!(
        s.events
            .last()
            .unwrap()
            .tactical
            .as_ref()
            .unwrap()
            .reason_code
            .as_deref(),
        Some("cast-cooldown")
    );
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
