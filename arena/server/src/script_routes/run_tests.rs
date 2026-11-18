use super::*;
use skyscraper_arena_server::{Command, Mode, Session};
use std::collections::BTreeMap;

#[tokio::test]
#[ignore = "requires TypeScript dependencies and built V8 runner"]
async fn run_example_previews_publishes_and_replays_the_submitted_route() {
    let directory = std::env::temp_dir().join(format!("arena-run-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("run-v8".into(), Mode::Training, 42);
    session.join("run-token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-scout".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    session.command("p1", Command::Step { ticks: 1 }).unwrap();
    let before = serde_json::to_value(session.snapshot()).unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer run-token".parse().unwrap());
    let example = include_str!("../../../script-sdk/examples/run.ts")
        .replace("'../src/index.ts'", "'@skyscraper/arena-script-sdk'");
    let project = SourceProject {
        files: BTreeMap::from([("main.ts".into(), example)]),
        entry: None,
    };
    let Json(previewed) = preview(
        State(store.clone()),
        Path("run-v8".into()),
        headers.clone(),
        Json(project.clone()),
    )
    .await
    .unwrap();
    assert_eq!(previewed["compilation"]["diagnostics"], json!([]));
    let run = previewed["execution"]["decision"]["intents"]
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["actorId"] == "p1-scout")
        .unwrap();
    assert_eq!(run["type"], "run");
    assert_eq!(run["viaRoomId"], "room-0");
    assert_eq!(run["roomId"], "room-4");
    store
        .with_session("run-v8", |s| {
            assert_eq!(serde_json::to_value(s.snapshot()).unwrap(), before);
            Ok(())
        })
        .await
        .unwrap();
    let Json(published) = publish(
        State(store.clone()),
        Path("run-v8".into()),
        headers.clone(),
        Json(project),
    )
    .await
    .unwrap();
    assert_eq!(published["compilation"]["diagnostics"], json!([]));
    let snapshot = store
        .command("run-v8", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    let scout = snapshot.actors.iter().find(|a| a.id == "p1-scout").unwrap();
    assert_eq!(scout.room_id, "room-4");
    assert_eq!(
        scout.last_movement.as_ref().unwrap().via_room_id.as_deref(),
        Some("room-0")
    );
    store.checkpoint().await.unwrap();
    let store = Store::open(directory.clone()).unwrap();
    store
        .with_session("run-v8", |s| {
            let replay = s.export_replay().unwrap();
            assert_eq!(
                serde_json::to_value(Session::from_replay(&replay).unwrap().snapshot()).unwrap(),
                serde_json::to_value(s.snapshot()).unwrap()
            );
            Ok(())
        })
        .await
        .unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}
