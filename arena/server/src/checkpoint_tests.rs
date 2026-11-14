use super::*;
use crate::replay::{MAX_REPLAY_BYTES, MAX_REPLAY_OPERATIONS};

fn restore(session: &mut Session) -> Session {
    let bytes = serde_json::to_vec(&session.checkpoint()).unwrap();
    Session::from_checkpoint(serde_json::from_slice(&bytes).unwrap()).unwrap()
}

fn assert_same(a: &mut Session, b: &mut Session) {
    assert_eq!(
        serde_json::to_value(a.checkpoint()).unwrap(),
        serde_json::to_value(b.checkpoint()).unwrap()
    );
}

#[test]
fn overflow_preserves_full_state_cooldowns_and_future_simulation() {
    let mut session = Session::new("long-training".into(), Mode::Training, 42);
    session.join("original-token".into()).unwrap();
    for _ in 0..MAX_REPLAY_OPERATIONS {
        session
            .command("p1", Command::Pause { paused: true })
            .unwrap();
    }
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-gatherer".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    assert!(session.export_replay().is_err());
    let mut restored = restore(&mut session);
    assert_same(&mut session, &mut restored);
    assert_eq!(restored.tokens["original-token"], "p1");
    assert!(
        restored
            .command(
                "p1",
                Command::Gather {
                    actor_id: "p1-gatherer".into()
                }
            )
            .is_err()
    );
    for _ in 0..30 {
        session.advance();
        restored.advance();
        assert_same(&mut session, &mut restored);
    }
    assert!(restored.export_replay().is_err());
    let mut next_restart = restore(&mut restored);
    assert_same(&mut restored, &mut next_restart);
}

#[test]
fn checkpoint_accepts_state_larger_than_public_replay_byte_limit() {
    let mut session = Session::new("large-save".into(), Mode::Training, 8);
    session.join("private-token".into()).unwrap();
    session.players.get_mut("p1").unwrap().name = "书".repeat(MAX_REPLAY_BYTES / 3 + 1);
    assert!(session.export_replay().is_err());
    let bytes = serde_json::to_vec(&session.checkpoint()).unwrap();
    assert!(bytes.len() > MAX_REPLAY_BYTES);
    let mut restored = Session::from_checkpoint(serde_json::from_slice(&bytes).unwrap()).unwrap();
    assert_same(&mut session, &mut restored);
}

#[test]
fn ordinary_checkpoint_preserves_public_replay_and_event_sequence() {
    let mut session = Session::new("ordinary".into(), Mode::Online, 15);
    session.join("first-token".into()).unwrap();
    session.join("second-token".into()).unwrap();
    for _ in 0..25 {
        session.advance();
    }
    let mut restored = restore(&mut session);
    assert_eq!(
        serde_json::to_value(session.export_replay().unwrap()).unwrap(),
        serde_json::to_value(restored.export_replay().unwrap()).unwrap()
    );
    for _ in 0..120 {
        session.advance();
        restored.advance();
        assert_same(&mut session, &mut restored);
    }
}
