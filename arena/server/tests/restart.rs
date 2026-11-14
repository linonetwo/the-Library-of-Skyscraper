#![cfg(unix)]
mod common;

use common::Server;
use serde_json::json;
use std::{
    fs, thread,
    time::{Duration, Instant},
};

#[test]
fn real_process_restart_restores_credentials_commands_and_checkpoints() {
    let directory = std::env::temp_dir().join(format!("arena-restart-{}", uuid::Uuid::new_v4()));
    let server = Server::start(&directory);
    let (status, credentials) = server.request(
        "POST",
        "/api/sessions",
        "",
        json!({"mode":"training","seed":73}),
    );
    assert_eq!(status, 200);
    let id = credentials["sessionId"].as_str().unwrap();
    let token = credentials["token"].as_str().unwrap();
    let command_path = format!("/api/sessions/{id}/commands");
    let state_path = format!("/api/sessions/{id}/state");
    assert_eq!(
        server
            .request(
                "POST",
                &command_path,
                token,
                json!({"type":"pause","paused":true})
            )
            .0,
        200
    );
    let appearance = json!({"outfit":"warden","hair":"midnight","weapon":false});
    let (status, expected) = server.request(
        "POST",
        &command_path,
        token,
        json!({"type":"equip","actorId":"p1-scout","appearance":appearance}),
    );
    assert_eq!(status, 200);
    server.stop();
    let archive = directory.join(format!("{id}.json"));
    let bytes = fs::read(&archive).unwrap();
    assert!(String::from_utf8_lossy(&bytes).contains(token));
    use std::os::unix::fs::PermissionsExt;
    assert_eq!(
        fs::metadata(&archive).unwrap().permissions().mode() & 0o777,
        0o600
    );
    assert_eq!(
        fs::metadata(&directory).unwrap().permissions().mode() & 0o777,
        0o700
    );

    let server = Server::start(&directory);
    assert_eq!(
        server.request("GET", &state_path, token, json!(null)),
        (200, expected)
    );
    assert_eq!(
        server
            .request("GET", &state_path, "another-token", json!(null))
            .0,
        401
    );
    let (status, replay) = server.request(
        "GET",
        &format!("/api/sessions/{id}/replay"),
        token,
        json!(null),
    );
    assert_eq!(status, 200);
    assert!(!replay.to_string().contains(token));
    let (status, expected) = server.request(
        "POST",
        &command_path,
        token,
        json!({"type":"step","ticks":3}),
    );
    assert_eq!(status, 200);
    let deadline = Instant::now() + Duration::from_secs(5);
    while fs::read(&archive).unwrap() == bytes {
        assert!(Instant::now() < deadline, "periodic checkpoint deadline");
        thread::sleep(Duration::from_millis(50));
    }
    server.crash();
    let server = Server::start(&directory);
    assert_eq!(
        server.request("GET", &state_path, token, json!(null)),
        (200, expected)
    );
    let before_read = fs::metadata(&archive).unwrap().modified().unwrap();
    thread::sleep(Duration::from_millis(2200));
    assert_eq!(
        fs::metadata(&archive).unwrap().modified().unwrap(),
        before_read
    );
    server.stop();
    fs::remove_dir_all(directory).unwrap();
}
