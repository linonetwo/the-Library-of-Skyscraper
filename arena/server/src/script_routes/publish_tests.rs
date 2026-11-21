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
    let mut session = Session::new_legacy("published".into(), Mode::Training, 42);
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

#[tokio::test]
#[ignore = "requires TypeScript toolchain dependencies and built V8 runner"]
async fn runtime_memory_survives_ticks_preview_and_restart() {
    let directory = std::env::temp_dir().join(format!("arena-runtime-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("runtime".into(), Mode::Training, 42);
    session.join("token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer token".parse().unwrap());
    let counter = || {
        project(
            "return { intents: [], memoryPatch: { set: { count: Number(ctx.memory.count ?? 0) + 1 } } };",
        )
    };
    let Json(result) = publish(
        State(store.clone()),
        Path("runtime".into()),
        headers.clone(),
        Json(counter()),
    )
    .await
    .unwrap();
    assert_eq!(result["compilation"]["diagnostics"], json!([]));
    store
        .command("runtime", &headers, Command::Step { ticks: 2 })
        .await
        .unwrap();
    for _ in 0..2 {
        let Json(previewed) = preview(
            State(store.clone()),
            Path("runtime".into()),
            headers.clone(),
            Json(counter()),
        )
        .await
        .unwrap();
        assert_eq!(
            previewed["execution"]["decision"]["memoryPatch"]["set"]["count"],
            3
        );
    }
    let Json(current) = state(
        State(store.clone()),
        Path("runtime".into()),
        headers.clone(),
    )
    .await
    .unwrap();
    assert_eq!(current["memory"]["count"], 2);
    store.checkpoint().await.unwrap();
    let restored = Store::open(directory.clone()).unwrap();
    restored
        .command("runtime", &headers, Command::Step { ticks: 1 })
        .await
        .unwrap();
    let Json(current) = state(State(restored), Path("runtime".into()), headers)
        .await
        .unwrap();
    assert_eq!(current["memory"]["count"], 3);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
#[ignore = "requires TypeScript toolchain dependencies and built V8 runner"]
async fn playable_script_travel_gather_wait_rollback_and_checkpoint() {
    let directory =
        std::env::temp_dir().join(format!("arena-playable-v8-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("playable-v8".into(), Mode::Training, 42);
    session.join("token".into()).unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer token".parse().unwrap());
    let movement = project(
        "return {intents:ctx.squad.actors.filter(a=>a.role==='gatherer').map(a=>a.roomId==='room-0'?{type:'move' as const,actorId:a.id,roomId:'room-1',priority:10}:{type:'gather' as const,actorId:a.id,priority:10})};",
    );
    let Json(publication) = publish(
        State(store.clone()),
        Path("playable-v8".into()),
        headers.clone(),
        Json(movement),
    )
    .await
    .unwrap();
    assert_eq!(publication["compilation"]["diagnostics"], json!([]));
    let hash = publication["compilation"]["bundle"]["sourceHash"]
        .as_str()
        .unwrap()
        .to_string();
    let state = store
        .command("playable-v8", &headers, Command::Step { ticks: 5 })
        .await
        .unwrap();
    let a = state.actors.iter().find(|a| a.role == "gatherer").unwrap();
    assert_eq!(a.room_id, "room-0");
    assert_eq!(a.world_position.x, 3.75);
    assert!(a.travel.is_some());
    store.checkpoint().await.unwrap();
    let store = Store::open(directory.clone()).unwrap();
    let state = store
        .command("playable-v8", &headers, Command::Step { ticks: 15 })
        .await
        .unwrap();
    let a = state.actors.iter().find(|a| a.role == "gatherer").unwrap();
    assert_eq!(a.room_id, "room-1");
    assert!(a.cargo > 0);
    let cargo = a.cargo;
    let _ = publish(
        State(store.clone()),
        Path("playable-v8".into()),
        headers.clone(),
        Json(project("return {intents:[]};")),
    )
    .await
    .unwrap();
    let state = store
        .command("playable-v8", &headers, Command::Step { ticks: 5 })
        .await
        .unwrap();
    assert_eq!(
        state
            .actors
            .iter()
            .find(|a| a.role == "gatherer")
            .unwrap()
            .cargo,
        cargo
    );
    let _ = crate::script_version_routes::rollback(
        State(store.clone()),
        Path("playable-v8".into()),
        headers.clone(),
        Json(crate::script_version_routes::Rollback { source_hash: hash }),
    )
    .await
    .unwrap();
    let state = store
        .command("playable-v8", &headers, Command::Step { ticks: 5 })
        .await
        .unwrap();
    assert!(
        state
            .actors
            .iter()
            .find(|a| a.role == "gatherer")
            .unwrap()
            .cargo
            > cargo
    );
    assert!(
        store
            .command(
                "playable-v8",
                &headers,
                Command::Task {
                    actor_id: "p1-gatherer".into(),
                    kind: "return".into(),
                    target: "room-0".into(),
                    building_kind: None
                }
            )
            .await
            .is_err()
    );
    store
        .with_session("playable-v8", |s| {
            let replay = s.export_replay().unwrap();
            Session::from_replay(&replay).unwrap();
            Ok(())
        })
        .await
        .unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
#[ignore = "requires TypeScript toolchain dependencies and built V8 runner"]
async fn playable_ts_gathers_returns_and_delivers_at_real_warehouse() {
    let directory =
        std::env::temp_dir().join(format!("arena-delivery-v8-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("delivery-v8".into(), Mode::Training, 42);
    session.join("token".into()).unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer token".parse().unwrap());
    let script = project(
        "const a=ctx.squad.actors.find(a=>a.role==='gatherer')!; if(a.travel)return {intents:[]}; const action=a.roomId==='room-0'?(a.cargo>0?{type:'deliver' as const}:{type:'move' as const,roomId:'room-1'}):(a.cargo>=a.cargoCapacity?{type:'move' as const,roomId:'room-0'}:{type:'gather' as const}); return {intents:[{...action,actorId:a.id,priority:10}]};",
    );
    let Json(output) = publish(
        State(store.clone()),
        Path("delivery-v8".into()),
        headers.clone(),
        Json(script),
    )
    .await
    .unwrap();
    assert_eq!(output["compilation"]["diagnostics"], json!([]));
    let state = store
        .command("delivery-v8", &headers, Command::Step { ticks: 80 })
        .await
        .unwrap();
    assert!(state.players[0].materials >= 34);
    assert!(state.scenario.report.materials_delivered >= 24);
    store
        .with_session("delivery-v8", |s| {
            let replay = s.export_replay().unwrap();
            Session::from_replay(&replay).unwrap();
            Ok(())
        })
        .await
        .unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}
