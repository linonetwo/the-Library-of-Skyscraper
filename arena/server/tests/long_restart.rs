#![cfg(unix)]
mod common;

use common::Server;
use serde_json::json;
use skyscraper_arena_server::{Command, Mode, Session, replay::MAX_REPLAY_OPERATIONS};
use std::{
    fs, thread,
    time::{Duration, Instant},
};

#[test]
fn overflowed_recording_keeps_saving_across_process_restarts() {
    let directory = std::env::temp_dir().join(format!("arena-long-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let mut session = Session::new("long-training".into(), Mode::Training, 42);
    session.join("original-token".into()).unwrap();
    for _ in 0..MAX_REPLAY_OPERATIONS {
        session
            .command("p1", Command::Pause { paused: true })
            .unwrap();
    }
    let archive = directory.join("long-training.json");
    fs::write(
        &archive,
        serde_json::to_vec(&json!({"checkpoint":session.checkpoint()})).unwrap(),
    )
    .unwrap();
    let server = Server::start(&directory);
    let commands = "/api/sessions/long-training/commands";
    let state = "/api/sessions/long-training/state";
    let token = "original-token";
    let movement = json!({"type":"move","actorId":"p1-gatherer","roomId":"room-1"});
    let (status, expected) = server.request("POST", commands, token, movement);
    assert_eq!(status, 200);
    let replay = server.request(
        "GET",
        "/api/sessions/long-training/replay",
        token,
        json!(null),
    );
    assert_eq!(replay.0, 409);
    assert!(
        replay.1["error"]
            .as_str()
            .unwrap()
            .contains("recording limit")
    );
    server.stop();

    let server = Server::start(&directory);
    assert_eq!(
        server.request("GET", state, token, json!(null)),
        (200, expected)
    );
    assert_eq!(
        server
            .request(
                "POST",
                commands,
                token,
                json!({"type":"gather","actorId":"p1-gatherer"})
            )
            .0,
        400
    );
    let bytes = fs::read(&archive).unwrap();
    let (status, expected) =
        server.request("POST", commands, token, json!({"type":"step","ticks":8}));
    assert_eq!(status, 200);
    let deadline = Instant::now() + Duration::from_secs(5);
    while fs::read(&archive).unwrap() == bytes {
        assert!(
            Instant::now() < deadline,
            "long-session checkpoint deadline"
        );
        thread::sleep(Duration::from_millis(50));
    }
    server.crash();
    let server = Server::start(&directory);
    assert_eq!(
        server.request("GET", state, token, json!(null)),
        (200, expected)
    );
    assert_eq!(
        server
            .request(
                "GET",
                "/api/sessions/long-training/replay",
                token,
                json!(null)
            )
            .0,
        409
    );
    server.stop();
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn legacy_replay_save_migrates_on_next_checkpoint() {
    let directory = std::env::temp_dir().join(format!("arena-migrate-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let mut session = Session::new("legacy".into(), Mode::Training, 27);
    session.join("legacy-token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session.command("p1", Command::Step { ticks: 3 }).unwrap();
    let archive = directory.join("legacy.json");
    let legacy = json!({"replay":session.export_replay().unwrap(),"tokens":session.tokens});
    fs::write(&archive, serde_json::to_vec(&legacy).unwrap()).unwrap();
    let server = Server::start(&directory);
    assert_eq!(
        server.request(
            "GET",
            "/api/sessions/legacy/state",
            "legacy-token",
            json!(null)
        ),
        (200, serde_json::to_value(session.snapshot()).unwrap())
    );
    assert_eq!(
        server
            .request(
                "POST",
                "/api/sessions/legacy/commands",
                "legacy-token",
                json!({"type":"step","ticks":2})
            )
            .0,
        200
    );
    server.stop();
    let saved: serde_json::Value = serde_json::from_slice(&fs::read(&archive).unwrap()).unwrap();
    assert_eq!(saved["checkpoint"]["snapshot"]["tick"], 5);
    assert_eq!(saved["checkpoint"]["tokens"]["legacy-token"], "p1");
    assert!(saved.get("replay").is_none());
    fs::remove_dir_all(directory).unwrap();
}
