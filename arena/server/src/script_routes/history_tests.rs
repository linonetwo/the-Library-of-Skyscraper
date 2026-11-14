use super::*;
use crate::script_version_routes::{Rollback, rollback};
use skyscraper_arena_server::{Command, Mode, Session};
use std::collections::BTreeMap;

fn movement(target: &str) -> SourceProject {
    SourceProject {
        files: BTreeMap::from([(
            "main.ts".into(),
            format!(
                "import type {{ RuleContext }} from '@skyscraper/arena-script-sdk'; \
             export function decide(ctx:RuleContext) {{ return {{ intents: ctx.squad.actors \
             .filter(a=>a.roomId!=='{target}').map(a=>({{type:'move' as const,actorId:a.id,roomId:'{target}',priority:10}})) }}; }}"
            ),
        )]),
        entry: None,
    }
}

#[tokio::test]
#[ignore = "requires TypeScript toolchain dependencies and built V8 runner"]
async fn published_a_b_rollback_a_drives_actual_ticks() {
    let directory = std::env::temp_dir().join(format!("arena-history-v8-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("history".into(), Mode::Training, 42);
    session.join("token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer token".parse().unwrap());
    let Json(a) = publish(
        State(store.clone()),
        Path("history".into()),
        headers.clone(),
        Json(movement("room-1")),
    )
    .await
    .unwrap();
    let hash = a["compilation"]["bundle"]["sourceHash"].as_str().unwrap();
    let state = store
        .command("history", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    assert!(state.actors.iter().all(|actor| actor.room_id == "room-1"));
    let Json(_) = publish(
        State(store.clone()),
        Path("history".into()),
        headers.clone(),
        Json(movement("room-0")),
    )
    .await
    .unwrap();
    let state = store
        .command("history", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    assert!(state.actors.iter().all(|actor| actor.room_id == "room-0"));
    let Json(state) = rollback(
        State(store.clone()),
        Path("history".into()),
        headers.clone(),
        Json(Rollback {
            source_hash: hash.into(),
        }),
    )
    .await
    .unwrap();
    assert_eq!(
        state.players[0].script.as_ref().unwrap().published_at_tick,
        2
    );
    store.checkpoint().await.unwrap();
    let store = Store::open(directory.clone()).unwrap();
    let state = store
        .command("history", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    assert!(state.actors.iter().all(|actor| actor.room_id == "room-1"));
    store
        .with_session("history", |session| {
            assert_eq!(session.script_versions("p1").versions.len(), 2);
            let replay = session.export_replay().unwrap();
            assert_eq!(
                serde_json::to_value(Session::from_replay(&replay).unwrap().snapshot()).unwrap(),
                serde_json::to_value(session.snapshot()).unwrap()
            );
            Ok(())
        })
        .await
        .unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}
