use super::*;
fn session() -> Session {
    let mut s = Session::new("test".into(), Mode::Training, 42);
    s.join("secret".into()).unwrap();
    s
}
#[test]
fn deterministic_seed_and_ticks() {
    let (mut a, mut b) = (session(), session());
    for _ in 0..120 {
        a.advance();
        b.advance();
    }
    assert_eq!(
        serde_json::to_value(a.snapshot()).unwrap(),
        serde_json::to_value(b.snapshot()).unwrap()
    );
}
#[test]
fn isolated_worlds() {
    let (mut a, b) = (session(), session());
    a.advance();
    assert_eq!(b.tick, 0);
    assert_eq!(b.players["p1"].materials, 40);
}
#[test]
fn cannot_overspend() {
    let mut s = session();
    s.command(
        "p1",
        Command::Build {
            room_id: "room-0".into(),
            kind: "tower".into(),
        },
    )
    .unwrap();
    assert!(
        s.command(
            "p1",
            Command::Build {
                room_id: "room-0".into(),
                kind: "catalog".into()
            }
        )
        .is_err()
    );
    assert_eq!(s.players["p1"].materials, 15);
}
#[test]
fn combat_and_settlement() {
    let mut s = session();
    for _ in 0..120 {
        s.advance();
    }
    assert_eq!(s.rooms[3].enemy_hp, 0);
    assert!(s.players["p1"].score > 0);
    assert!(s.result.is_some());
    assert!(s.events.len() <= 100);
}
#[test]
fn ownership_and_online_debug() {
    let mut s = Session::new("test".into(), Mode::Online, 42);
    s.join("a".into()).unwrap();
    s.join("b".into()).unwrap();
    assert!(
        s.command(
            "p2",
            Command::Move {
                actor_id: "p1-scout".into(),
                room_id: "room-1".into()
            }
        )
        .is_err()
    );
    assert!(s.command("p1", Command::Step { ticks: 1 }).is_err());
    assert!(s.command("p1", Command::Reset {}).is_err());
}
#[test]
fn validate_rules_and_steps() {
    let mut s = session();
    assert!(
        s.command(
            "p1",
            Command::Rule {
                preset: "eval".into(),
                retreat_hp: 30
            }
        )
        .is_err()
    );
    assert!(
        s.command(
            "p1",
            Command::Rule {
                preset: "gather".into(),
                retreat_hp: 101
            }
        )
        .is_err()
    );
    s.paused = true;
    assert!(s.command("p1", Command::Step { ticks: 121 }).is_err());
    assert!(s.command("p1", Command::Step { ticks: 0 }).is_err());
}
#[test]
fn manual_actions_are_rate_bounded() {
    let mut s = session();
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-gatherer".into(),
            room_id: "room-1".into(),
        },
    )
    .unwrap();
    assert!(
        s.command(
            "p1",
            Command::Gather {
                actor_id: "p1-gatherer".into()
            }
        )
        .is_err()
    );
    s.advance();
    s.command(
        "p1",
        Command::Gather {
            actor_id: "p1-gatherer".into(),
        },
    )
    .unwrap();
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
#[test]
fn reset_reproduces_seed_and_preserves_credentials() {
    let mut s = session();
    for _ in 0..120 {
        s.advance();
    }
    let first = serde_json::to_value(s.snapshot()).unwrap();
    s.command("p1", Command::Reset {}).unwrap();
    assert!(s.paused);
    assert_eq!(s.tokens["secret"], "p1");
    assert_eq!(s.tick, 0);
    s.command("p1", Command::Pause { paused: false }).unwrap();
    for _ in 0..120 {
        s.advance();
    }
    assert_eq!(first, serde_json::to_value(s.snapshot()).unwrap());
}
#[test]
fn different_seed_changes_resources() {
    let a = session();
    let b = Session::new("test".into(), Mode::Training, 43);
    assert_ne!(a.rooms[1].resources, b.rooms[1].resources);
}
#[test]
fn malformed_commands_rejected() {
    for command in [
        r#"{"type":"step","ticks":-1}"#,
        r#"{"type":"step","ticks":1.5}"#,
        r#"{"type":"step","ticks":99999999999999999999}"#,
        r#"{"type":"step","ticks":1,"arbitrary":"code"}"#,
        r#"{"type":"execute","code":"process.exit()"}"#,
    ] {
        assert!(serde_json::from_str::<Command>(command).is_err());
    }
}
#[test]
fn manual_command_replaces_next_autonomous_action() {
    let mut s = session();
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-gatherer".into(),
            room_id: "room-1".into(),
        },
    )
    .unwrap();
    s.advance();
    assert_eq!(s.players["p1"].materials, 40);
    s.advance();
    assert_eq!(s.players["p1"].materials, 48);
}
#[test]
fn symmetric_online_squads_cannot_steal_by_iteration_order() {
    let mut s = Session::new("test".into(), Mode::Online, 42);
    s.join("a".into()).unwrap();
    s.join("b".into()).unwrap();
    for _ in 0..120 {
        s.advance();
    }
    assert!(s.rooms[2].owner.is_none());
    assert!(s.rooms[3].owner.is_none());
    assert_eq!(s.players["p1"].score, s.players["p2"].score);
}
