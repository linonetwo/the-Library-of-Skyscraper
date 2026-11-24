// These assertions preserve the historical v0.2 timing/economy for old recordings.
use super::*;

fn round_trip(session: &mut Session) -> Session {
    let replay = session.export_replay().unwrap();
    let bytes = serde_json::to_vec(&replay).unwrap();
    assert!(!String::from_utf8_lossy(&bytes).contains("live-secret"));
    let decoded = Replay::from_json(&bytes).unwrap();
    let mut restored = Session::from_replay(&decoded).unwrap();
    assert_eq!(
        serde_json::to_value(session.snapshot()).unwrap(),
        serde_json::to_value(restored.snapshot()).unwrap()
    );
    restored
}

#[test]
fn two_player_commands_ticks_rejections_and_future_simulation() {
    let mut session = Session::new_legacy("online-replay".into(), Mode::Online, 937);
    session.join("live-secret-one".into()).unwrap();
    session.advance();
    session.join("live-secret-two".into()).unwrap();
    session
        .command(
            "p2",
            Command::Rule {
                assign_tasks: false,
                preset: "explore".into(),
                retreat_hp: 45,
            },
        )
        .unwrap();
    session
        .command(
            "p2",
            Command::Move {
                actor_id: "p2-gatherer".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    let count = session.replay_operations.len();
    assert!(
        session
            .command(
                "p1",
                Command::Gather {
                    actor_id: "p2-gatherer".into()
                }
            )
            .is_err()
    );
    assert!(session.command("p1", Command::Reset {}).is_err());
    assert!(session.command("p1", Command::Step { ticks: 2 }).is_err());
    assert_eq!(session.replay_operations.len(), count);
    let mut restored = round_trip(&mut session);
    // Subsequent ticks also exercise internal cooldown reconstruction.
    for _ in 0..120 {
        session.advance();
        restored.advance();
        assert_eq!(
            serde_json::to_value(session.snapshot()).unwrap(),
            serde_json::to_value(restored.snapshot()).unwrap()
        );
    }
    round_trip(&mut session);
}

#[test]
fn training_steps_reset_preserve_history_without_duplicate_ticks_or_joins() {
    let mut session = Session::new_legacy("training-replay".into(), Mode::Training, 31);
    session.join("live-secret".into()).unwrap();
    assert!(session.command("p1", Command::Step { ticks: 1 }).is_err());
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session.command("p1", Command::Step { ticks: 120 }).unwrap();
    assert_eq!(session.replay_operations.len(), 3);
    round_trip(&mut session);
    session.command("p1", Command::Reset {}).unwrap();
    assert_eq!(session.replay_operations.len(), 4);
    assert_eq!(session.tick, 0);
    assert_eq!(session.tokens["live-secret"], "p1");
    session.command("p1", Command::Step { ticks: 12 }).unwrap();
    assert_eq!(session.tick, 12);
    assert_eq!(session.replay_operations.len(), 5);
    round_trip(&mut session);
}

#[test]
fn tampering_versions_invalid_operations_and_limits_rejected() {
    let mut session = Session::new_legacy("bounds".into(), Mode::Training, 1);
    session.join("live-secret".into()).unwrap();
    let replay = session.export_replay().unwrap();
    let mut tampered = replay.clone();
    tampered.final_snapshot.tick += 1;
    assert!(Session::from_replay(&tampered).is_err());
    tampered = replay.clone();
    tampered.version += 1;
    assert!(Session::from_replay(&tampered).is_err());
    tampered = replay.clone();
    tampered.operations.push(ReplayOperation::Command {
        player_id: "intruder".into(),
        command: Command::Reset {},
    });
    assert!(Session::from_replay(&tampered).is_err());
    tampered.operations = vec![ReplayOperation::Advance {}; MAX_REPLAY_OPERATIONS + 1];
    assert!(Session::from_replay(&tampered).is_err());
    assert!(Replay::from_json(&vec![b' '; MAX_REPLAY_BYTES + 1]).is_err());
    for _ in 0..MAX_REPLAY_OPERATIONS {
        session
            .command("p1", Command::Pause { paused: true })
            .unwrap();
    }
    assert!(session.export_replay().is_err());
    session.command("p1", Command::Reset {}).unwrap();
    assert!(
        session.export_replay().is_err(),
        "reset cannot erase overflow"
    );
}

#[test]
fn timeline_follows_operations_across_reset_and_keeps_live_state() {
    let mut session = Session::new_legacy("timeline".into(), Mode::Training, 42);
    session.join("live-secret".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session.command("p1", Command::Step { ticks: 12 }).unwrap();
    session.command("p1", Command::Reset {}).unwrap();
    session.command("p1", Command::Step { ticks: 3 }).unwrap();
    let live = serde_json::to_value(session.snapshot()).unwrap();
    let timeline = session.export_replay().unwrap().timeline().unwrap();
    assert_eq!(
        timeline
            .frames
            .iter()
            .map(|frame| frame.tick)
            .collect::<Vec<_>>(),
        vec![0, 0, 0, 12, 0, 3]
    );
    assert_eq!(
        timeline
            .frames
            .iter()
            .map(|frame| frame.operation_index)
            .collect::<Vec<_>>(),
        vec![0, 1, 2, 3, 4, 5]
    );
    assert_eq!(
        serde_json::to_value(&timeline.frames.last().unwrap().snapshot).unwrap(),
        live
    );
    assert_eq!(serde_json::to_value(session.snapshot()).unwrap(), live);
    assert_eq!(session.tokens["live-secret"], "p1");
}

#[test]
fn legacy_script_advance_keeps_per_intent_rejection_semantics() {
    let mut session = Session::new_legacy("legacy-script".into(), Mode::Online, 42);
    session.join("owner".into()).unwrap();
    session.join("other".into()).unwrap();
    let decision: crate::ScriptDecision = serde_json::from_value(serde_json::json!({
        "playerId":"p1", "intents":[
            {"type":"move","actorId":"p2-scout","roomId":"room-1","priority":10},
            {"type":"move","actorId":"p1-scout","roomId":"room-1","priority":9}
        ]
    }))
    .unwrap();
    session.advance_scripted_recorded(vec![decision], false);
    let replay = session.export_replay().unwrap();
    let mut legacy = serde_json::to_value(&replay).unwrap();
    legacy["version"] = serde_json::json!(1);
    for op in legacy["operations"].as_array_mut().unwrap() {
        op.as_object_mut().unwrap().remove("runtimeValidated");
    }
    let replay = Replay::from_json(&serde_json::to_vec(&legacy).unwrap()).unwrap();
    let mut restored = Session::from_replay(&replay).unwrap();
    assert_eq!(
        restored
            .snapshot()
            .actors
            .iter()
            .find(|a| a.id == "p1-scout")
            .unwrap()
            .room_id,
        "room-1"
    );
    let upgraded = restored.export_replay().unwrap();
    Session::from_replay(&upgraded).unwrap();
}

#[test]
fn selected_operation_restores_across_reset_without_using_same_tick_or_final_state() {
    let mut session = Session::new_legacy("selected-frame".into(), Mode::Training, 42);
    session.join("token".into()).unwrap();
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-scout".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    session.advance();
    let before_reset = session.export_replay().unwrap().operations.len();
    let first = serde_json::to_value(session.snapshot()).unwrap();
    session.command("p1", Command::Reset {}).unwrap();
    session.advance();
    let replay = session.export_replay().unwrap();
    let after_reset = replay.operations.len();
    let second = serde_json::to_value(session.snapshot()).unwrap();
    assert_eq!(first["tick"], second["tick"]);
    assert_ne!(first["actors"], second["actors"]);
    assert_eq!(
        serde_json::to_value(
            replay
                .session_after_operation(before_reset)
                .unwrap()
                .snapshot()
        )
        .unwrap(),
        first
    );
    assert_eq!(
        serde_json::to_value(
            replay
                .session_after_operation(after_reset)
                .unwrap()
                .snapshot()
        )
        .unwrap(),
        second
    );
    assert_eq!(replay.session_after_operation(0).unwrap().tick, 0);
    assert!(replay.session_after_operation(after_reset + 1).is_err());
}
