//! Explicit fixed-HP unit cases; these are not natural-combat evidence.
use crate::*;
use serde_json::{json, to_value};

fn game() -> Session {
    let mut s = Session::new("retreat-control".into(), Mode::Training, 42);
    s.join("one".into()).unwrap();
    s.enemies.clear();
    s
}
fn bind(s: &mut Session, owner: &str) {
    s.set_script_metadata(
        owner,
        Some(ScriptMetadata {
            source_hash: "test".into(),
            entry: "main.ts".into(),
            published_at_tick: s.tick,
        }),
    );
}
fn edit(s: &mut Session, owner: &str, f: impl FnOnce(&mut Actor)) {
    let (e, mut a) = s.owned_actor(owner, &format!("{owner}-guard")).unwrap();
    f(&mut a);
    s.world.entity_mut(e).insert(a);
}
fn guard(s: &mut Session, owner: &str) -> Actor {
    s.owned_actor(owner, &format!("{owner}-guard")).unwrap().1
}
fn front(a: &mut Actor, hp: u32) {
    a.hp = hp;
    a.room_id = "room-3".into();
    a.world_position = Position { x: -8., y: 6.2 };
    a.task = None;
    a.travel = None;
}

#[test]
fn script_hold_and_failure_never_fall_back_to_preset_but_other_owner_does() {
    let mut s = game();
    s.mode = Mode::Online;
    s.join("two".into()).unwrap();
    bind(&mut s, "p1");
    assert_eq!(s.players["p1"].rule.retreat_hp, 35);
    for owner in ["p1", "p2"] {
        edit(&mut s, owner, |a| front(a, 30));
    }
    s.advance_scripted(vec![ScriptDecision {
        source_hash: Some("test".into()),
        player_id: "p1".into(),
        intents: vec![],
        memory_patch: None,
        task_patches: None,
        failure: None,
    }]);
    let held = guard(&mut s, "p1");
    assert_eq!(held.hp, 30);
    assert!(!held.retreating);
    assert!(held.travel.is_none());
    assert!(guard(&mut s, "p2").retreating);
    s.advance_scripted(vec![ScriptDecision {
        source_hash: Some("test".into()),
        player_id: "p1".into(),
        intents: vec![],
        memory_patch: None,
        task_patches: None,
        failure: Some("expected failure".into()),
    }]);
    assert!(!guard(&mut s, "p1").retreating);
    assert!(guard(&mut s, "p1").travel.is_none());
}

#[test]
fn base_heals_once_without_locking_script_and_presets_still_unlock_at_eighty() {
    let mut s = game();
    bind(&mut s, "p1");
    s.tick = 1;
    edit(&mut s, "p1", |a| {
        a.hp = 59;
        a.task = None;
    });
    s.advance();
    let healed = guard(&mut s, "p1");
    assert_eq!(healed.hp, 63);
    assert!(!healed.retreating);
    assert_ne!(healed.state, "recovering");
    s.advance_scripted(vec![ScriptDecision {
        source_hash: Some("test".into()),
        player_id: "p1".into(),
        intents: serde_json::from_value(
            json!([{"type":"move","actorId":"p1-guard","roomId":"room-3","priority":100}]),
        )
        .unwrap(),
        memory_patch: None,
        task_patches: None,
        failure: None,
    }]);
    let departing = guard(&mut s, "p1");
    assert_eq!(departing.travel.unwrap().target_room_id, "room-3");
    assert!(!departing.retreating);
    assert_eq!(departing.hp, 63);
    s.advance(); // even tick, while the roomId still names home
    assert_eq!(guard(&mut s, "p1").hp, 63);
    // Neither a stationary dead actor nor an actor travelling through home heals.
    edit(&mut s, "p1", |a| a.hp = 0);
    s.advance();
    assert_eq!(guard(&mut s, "p1").hp, 0);
    let mut preset = game();
    preset.tick = 1;
    edit(&mut preset, "p1", |a| {
        a.hp = 34;
        a.task = None;
    });
    preset.advance();
    let a = guard(&mut preset, "p1");
    assert_eq!(a.hp, 38);
    assert!(a.retreating); // before-heal HP must trigger the latch
    edit(&mut preset, "p1", |a| a.hp = 78);
    preset.tick = 3;
    preset.advance();
    let a = guard(&mut preset, "p1");
    assert_eq!(a.hp, 82);
    assert!(!a.retreating);
    edit(&mut preset, "p1", |a| {
        a.hp = 99;
        a.retreating = false;
    });
    preset.tick = 5;
    preset.advance();
    assert_eq!(guard(&mut preset, "p1").hp, 100);
}

#[test]
fn switching_controllers_keeps_committed_motion_then_rechecks_current_hp() {
    let mut s = game();
    edit(&mut s, "p1", |a| front(a, 30));
    s.advance();
    let before = guard(&mut s, "p1");
    assert!(before.retreating);
    let route = to_value(&before.travel).unwrap();
    bind(&mut s, "p1");
    let taken = guard(&mut s, "p1");
    assert!(!taken.retreating);
    assert_eq!(taken.world_position, before.world_position);
    assert_eq!(to_value(&taken.travel).unwrap(), route);
    s.advance();
    let moved = guard(&mut s, "p1");
    assert_ne!(moved.world_position, taken.world_position);
    assert_eq!(moved.travel.as_ref().unwrap().target_room_id, "room-0");
    let route = to_value(&moved.travel).unwrap();
    s.disable_script("p1");
    let restored = guard(&mut s, "p1");
    assert!(!restored.retreating);
    assert_eq!(to_value(&restored.travel).unwrap(), route);
    s.advance();
    assert!(guard(&mut s, "p1").retreating);
    // Arrival is integrated before task_tick: a newly arrived script actor heals that same tick.
    bind(&mut s, "p1");
    for _ in 0..60 {
        if guard(&mut s, "p1").travel.is_none() {
            break;
        }
        s.advance();
    }
    let arrived = guard(&mut s, "p1");
    assert_eq!(arrived.room_id, "room-0");
    assert!(!arrived.retreating);
    assert_eq!(arrived.hp, if s.tick.is_multiple_of(2) { 34 } else { 30 });
}

#[test]
fn old_versions_keep_script_safety_latch_and_latch_only_healing() {
    for version in [3, 4, 5] {
        let mut s = game();
        s.configure_replay_version(version);
        bind(&mut s, "p1");
        s.tick = 1;
        edit(&mut s, "p1", |a| {
            a.hp = 59;
            a.task = None;
        });
        s.advance();
        assert_eq!(guard(&mut s, "p1").hp, 59);
        edit(&mut s, "p1", |a| front(a, 30));
        s.advance();
        assert!(guard(&mut s, "p1").retreating);
        bind(&mut s, "p1");
        assert!(guard(&mut s, "p1").retreating);
    }
}

#[test]
fn metadata_control_replays_and_checkpoints_keep_their_recorded_version() {
    for version in [5, 6] {
        let mut s = Session::new("recorded-control".into(), Mode::Training, 42);
        s.configure_replay_version(version);
        s.join("owner".into()).unwrap();
        bind(&mut s, "p1");
        s.advance_scripted(vec![ScriptDecision {
            source_hash: Some("test".into()),
            player_id: "p1".into(),
            intents: serde_json::from_value(
                json!([{"type":"move","actorId":"p1-guard","roomId":"room-3","priority":100}]),
            )
            .unwrap(),
            memory_patch: None,
            task_patches: None,
            failure: None,
        }]);
        for _ in 0..65 {
            s.advance_scripted(vec![]);
        }
        s.disable_script("p1");
        for _ in 0..15 {
            s.advance();
        }
        let recording = s.export_replay().unwrap();
        assert_eq!(recording.simulation_version, version);
        let mut replayed = Session::from_replay(&recording).unwrap();
        let mut checkpointed = Session::from_checkpoint(s.checkpoint()).unwrap();
        for _ in 0..20 {
            assert_eq!(
                to_value(s.snapshot()).unwrap(),
                to_value(replayed.snapshot()).unwrap()
            );
            assert_eq!(
                to_value(s.snapshot()).unwrap(),
                to_value(checkpointed.snapshot()).unwrap()
            );
            s.advance();
            replayed.advance();
            checkpointed.advance();
        }
    }
}
