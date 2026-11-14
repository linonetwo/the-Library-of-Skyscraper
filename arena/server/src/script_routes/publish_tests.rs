use super::*;
use skyscraper_arena_server::{Command, Mode, Session};
use std::collections::BTreeMap;

fn project(body: &str) -> SourceProject {
    SourceProject {
        files: BTreeMap::from([(
            "main.ts".into(),
            format!(
                "import type {{ RuleContext }} from '@skyscraper/arena-script-sdk'; export function decide(ctx:RuleContext) {{ {body} }}"
            ),
        )]),
        entry: None,
    }
}

#[tokio::test]
#[ignore = "requires TypeScript toolchain dependencies and built V8 runner"]
async fn publish_drives_steps_clock_hold_disable_and_checkpoint() {
    let directory = std::env::temp_dir().join(format!("arena-publish-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("published".into(), Mode::Training, 42);
    session.join("script-token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer script-token".parse().unwrap());
    let movement = project(
        "return { intents: ctx.squad.actors.filter(a=>a.roomId==='room-0').map(a=>({type:'move' as const, actorId:a.id, roomId:'room-1', priority:10})) };",
    );
    let Json(publication) = publish(
        State(store.clone()),
        Path("published".into()),
        headers.clone(),
        Json(movement),
    )
    .await
    .unwrap();
    assert_eq!(publication["compilation"]["diagnostics"], json!([]));
    assert!(publication["snapshot"]["players"][0]["script"]["sourceHash"].is_string());
    let snapshot = store
        .command("published", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    assert!(
        snapshot
            .actors
            .iter()
            .all(|actor| actor.room_id == "room-1")
    );
    store.checkpoint().await.unwrap();
    let store = Store::open(directory.clone()).unwrap();
    let snapshot = store
        .command("published", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    assert!(
        snapshot
            .actors
            .iter()
            .all(|actor| actor.room_id == "room-1" && actor.cargo == 0)
    );
    store
        .command("published", &headers, Command::Reset {})
        .await
        .unwrap();
    store
        .command("published", &headers, Command::Pause { paused: false })
        .await
        .unwrap();
    store.advance().await;
    store
        .with_session("published", |session| {
            assert!(
                session
                    .snapshot()
                    .actors
                    .iter()
                    .all(|actor| actor.room_id == "room-1")
            );
            let replay = session.export_replay().unwrap();
            assert_eq!(
                serde_json::to_value(session.snapshot()).unwrap(),
                serde_json::to_value(Session::from_replay(&replay).unwrap().snapshot()).unwrap()
            );
            Ok(())
        })
        .await
        .unwrap();
    let Json(_) = publish(
        State(store.clone()),
        Path("published".into()),
        headers.clone(),
        Json(project("return {intents:[]};")),
    )
    .await
    .unwrap();
    store.advance().await;
    store
        .with_session("published", |session| {
            assert!(
                session
                    .snapshot()
                    .actors
                    .iter()
                    .all(|actor| actor.cargo == 0)
            );
            Ok(())
        })
        .await
        .unwrap();
    let Json(_) = disable(
        State(store.clone()),
        Path("published".into()),
        headers.clone(),
    )
    .await
    .unwrap();
    store.advance().await;
    store
        .with_session("published", |session| {
            assert!(session.players["p1"].script.is_none());
            assert!(
                session
                    .snapshot()
                    .actors
                    .iter()
                    .all(|actor| actor.cargo > 0)
            );
            Ok(())
        })
        .await
        .unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}
