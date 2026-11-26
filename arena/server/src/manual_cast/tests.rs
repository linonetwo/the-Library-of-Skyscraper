use super::*;
use crate::{script_version_routes, store::Store};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use skyscraper_arena_server::{Mode, ScenarioId};

// Actual compiler + native worker, command-only authority unit; no HTTP service or browser.
#[tokio::test]
#[ignore = "requires installed toolchain and the actual T2 runner"]
async fn actual_worker_manual_cast_archives_and_survives_restart() {
    let directory =
        std::env::temp_dir().join(format!("arena-manual-cast-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new_scenario(
        "manual-cast".into(),
        Mode::Online,
        42,
        ScenarioId::FirstExpedition,
    );
    session.join("owner-only".into()).unwrap();
    session.join("guest-only".into()).unwrap();
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-guard".into(),
                room_id: "room-3".into(),
            },
        )
        .unwrap();
    while session
        .snapshot()
        .actors
        .iter()
        .find(|a| a.id == "p1-guard")
        .unwrap()
        .travel
        .is_some()
    {
        session.advance();
    }
    let before = session.snapshot();
    let target = before
        .enemies
        .iter()
        .find(|e| e.hp > 0 && e.room_id == "room-3")
        .unwrap();
    let target_id = target.id.clone();
    let before_hp = target.hp;
    let started = before.tick;
    store.insert(session).await;
    let mut owner = HeaderMap::new();
    owner.insert("authorization", "Bearer owner-only".parse().unwrap());
    let mut guest = HeaderMap::new();
    guest.insert("authorization", "Bearer guest-only".parse().unwrap());
    let started_snapshot = store
        .command(
            "manual-cast",
            &owner,
            Command::Cast {
                actor_id: "p1-guard".into(),
                skill_id: skyscraper_arena_server::SkillId::InkStrike,
                target_id: target_id.clone(),
            },
        )
        .await
        .unwrap();
    let caster = started_snapshot
        .tactics
        .unwrap()
        .actor_states
        .into_iter()
        .find(|a| a.actor_id == "p1-guard")
        .unwrap();
    assert_eq!(caster.cast.unwrap().release_tick, started + 2);
    assert_eq!(caster.energy, 2);
    let replay = store
        .with_session("manual-cast", |s| {
            Ok(s.export_replay_for(Some("p1")).unwrap())
        })
        .await
        .unwrap();
    let record = replay
        .operations
        .iter()
        .find_map(|op| match op {
            skyscraper_arena_server::ReplayOperation::Command {
                chant: Some(RecordedChant::Worker(c)),
                ..
            } => Some(c),
            _ => None,
        })
        .unwrap();
    assert_eq!(record.observed_tick, started);
    assert_eq!(record.steps.len(), 3);
    assert_eq!(
        record.skill_source_hash,
        "441286bde12c417312258ecd0c12f698fbe9fbceba8139fc09e51cffe9dfd4e8"
    );
    let hash = record.skill_source_hash.clone();
    store.checkpoint().await.unwrap();
    drop(store);
    let restored = Store::open(directory.clone()).unwrap();
    let Json(source) = script_version_routes::version(
        State(restored.clone()),
        Path(("manual-cast".into(), hash.clone())),
        owner.clone(),
    )
    .await
    .unwrap();
    assert_eq!(source["version"]["kind"], "skill");
    assert_eq!(source["project"]["files"]["ink-strike.js"], OFFICIAL_SOURCE);
    assert!(
        restored
            .with_session("manual-cast", |s| Ok(s
                .script_versions("p1")
                .versions
                .is_empty()))
            .await
            .unwrap()
    );
    let denied = script_version_routes::version(
        State(restored.clone()),
        Path(("manual-cast".into(), hash)),
        guest,
    )
    .await
    .unwrap_err();
    assert_eq!(denied.0, StatusCode::NOT_FOUND);
    restored
        .edit_session("manual-cast", |s| {
            s.advance();
            s.advance();
            Ok(())
        })
        .await
        .unwrap();
    let final_snapshot = restored
        .with_session("manual-cast", |s| Ok(s.snapshot()))
        .await
        .unwrap();
    assert_eq!(
        final_snapshot
            .enemies
            .iter()
            .find(|e| e.id == target_id)
            .unwrap()
            .hp,
        before_hp - 16
    );
    assert!(
        final_snapshot
            .events
            .iter()
            .any(|e| e.tactical.as_ref().is_some_and(|t| t.action
                == skyscraper_arena_server::TacticalAction::Cast
                && t.phase == skyscraper_arena_server::TacticalPhase::Released))
    );
    let own = restored
        .with_session("manual-cast", |s| {
            Ok(s.export_replay_for(Some("p1")).unwrap())
        })
        .await
        .unwrap();
    let public = restored
        .with_session("manual-cast", |s| Ok(s.export_replay().unwrap()))
        .await
        .unwrap();
    let public_json = serde_json::to_string(&public).unwrap();
    assert!(!public_json.contains("skillSourceHash"));
    assert!(!public_json.contains("\"steps\""));
    assert!(!public_json.contains("owner-only"));
    assert!(
        serde_json::to_string(&own)
            .unwrap()
            .contains("skillSourceHash")
    );
    let released = own
        .final_snapshot
        .events
        .iter()
        .find_map(|e| {
            e.tactical
                .as_ref()
                .filter(|t| t.phase == skyscraper_arena_server::TacticalPhase::Released)
        })
        .unwrap();
    assert_eq!(
        released.target_position,
        own.final_snapshot
            .enemies
            .iter()
            .find(|e| e.id == target_id)
            .map(|e| e.world_position)
    );
    Session::from_replay(&own).unwrap();
    Session::from_replay(&public).unwrap();
    drop(restored);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
#[ignore = "requires installed toolchain and the actual T2 runner"]
async fn actual_worker_old_sim7_cast_rejects_without_tactical_archive() {
    let project = SourceProject {
        entry: Some("main.ts".into()),
        files: BTreeMap::from([("main.ts".into(), "export function decide(ctx:any){return {intents:[{type:'cast',actorId:'p1-guard',skillId:'ink-strike',targetId:'enemy-1',priority:100} as const]};}".into())]),
    };
    let compiled = compile_project(&project).await.unwrap();
    assert!(compiled.get("bundle").is_some(), "{compiled}");
    let mut session = Session::new("old-script-cast".into(), Mode::Training, 42);
    session.join("old-owner".into()).unwrap();
    session.publish_script(
        "p1",
        skyscraper_arena_server::PublishedScript {
            project,
            bundle: compiled["bundle"].clone(),
        },
    );
    crate::script_driver::advance(&mut session, &ScriptWorkers::default()).await;
    assert_eq!(session.tick, 1);
    assert!(session.snapshot().tactics.is_none());
    assert!(session.events.iter().any(|e| e.kind == "script-rejected"));
    let replay = session.export_replay_for(Some("p1")).unwrap();
    assert!(
        serde_json::to_string(&replay)
            .unwrap()
            .contains("skillSourceHash"),
        "actual worker invocation was recorded despite the old-version command rejection"
    );
    Session::from_replay(&replay).unwrap();
}
