use super::compare::{CompareRequest, InitialState};
use super::*;
use skyscraper_arena_server::{Mode, ScriptDecision, Session};
use std::collections::BTreeMap;

fn headers(token: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("authorization", format!("Bearer {token}").parse().unwrap());
    headers
}
fn candidate(threshold: u32) -> SourceProject {
    SourceProject {
        entry: None,
        files: BTreeMap::from([(
            "main.ts".into(),
            format!(
                r#"
import type {{ RuleContext }} from '@skyscraper/arena-script-sdk';
export function decide(ctx: RuleContext) {{
 const actor=ctx.squad.actors[0];
 return {{ intents: actor.hp < {threshold}
   ? [{{type:'move' as const,actorId:actor.id,roomId:'room-0',priority:1}}]
   : [{{type:'gather' as const,actorId:actor.id,priority:1}}],
   memoryPatch:{{set:{{observed:{{owner:ctx.player.id,tick:ctx.tick,
     memoryKeys:Object.keys(ctx.memory),taskIds:ctx.tasks.items.map(t=>t.id)}}}}}},
   taskPatches:ctx.tasks.items.map(t=>({{type:'remove' as const,taskId:t.id}})) }};
}}
"#
            ),
        )]),
    }
}
fn request(index: usize) -> PreviewRequest {
    PreviewRequest::Compare(CompareRequest {
        operation_index: index,
        a: candidate(90),
        b: candidate(110),
        initial_state: InitialState::Empty,
    })
}

#[test]
fn compare_request_accepts_only_explicit_empty_state_and_server_frame_address() {
    let project = serde_json::to_value(candidate(90)).unwrap();
    let valid = json!({"operationIndex":3,"a":project,"b":project,"initialState":"empty"});
    assert!(serde_json::from_value::<PreviewRequest>(valid.clone()).is_ok());
    for (key, value) in [
        ("owner", json!("p2")),
        ("snapshot", json!({})),
        ("initialState", json!("current")),
        ("operationIndex", json!(-1)),
    ] {
        let mut bad = valid.clone();
        bad[key] = value;
        assert!(serde_json::from_value::<PreviewRequest>(bad).is_err());
    }
    assert!(serde_json::from_value::<PreviewRequest>(project).is_ok());
}

#[tokio::test]
#[ignore = "requires TypeScript toolchain dependencies and built V8 runner"]
async fn comparison_restores_owner_frame_and_keeps_each_v8_result_without_side_effects() {
    let directory = std::env::temp_dir().join(format!("arena-compare-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut s = Session::new("compare".into(), Mode::Online, 42);
    s.join("one".into()).unwrap();
    s.join("two".into()).unwrap();
    s.advance_scripted(["p1","p2"].map(|owner| ScriptDecision {
        chants: None,
player_id:owner.into(),source_hash:Some("history".into()),intents:vec![],failure:None,
        memory_patch:Some(json!({"set":{"privateOwner":owner}})),
        task_patches:Some(vec![json!({"type":"upsert","task":{"id":format!("{owner}-task"),"actorId":format!("{owner}-scout"),"roomId":"room-1","kind":"gather","priority":1,"status":"queued","blockedReason":null}})]),
    }).to_vec());
    let index = s.export_replay().unwrap().operations.len();
    let before = serde_json::to_value(s.checkpoint()).unwrap();
    store.insert(s).await;
    for (token, owner) in [("one", "p1"), ("two", "p2")] {
        let Json(value) = preview(
            State(store.clone()),
            Path("compare".into()),
            headers(token),
            Json(request(index)),
        )
        .await
        .unwrap();
        assert_eq!(value["operationIndex"], index);
        assert_eq!(value["tick"], 1);
        assert_eq!(value["ownerId"], owner);
        assert_eq!(value["initialState"]["mode"], "empty");
        assert_eq!(value["context"]["memory"], json!({}));
        assert_eq!(
            value["a"]["execution"]["decision"]["intents"][0]["type"],
            "gather"
        );
        assert_eq!(
            value["b"]["execution"]["decision"]["intents"][0]["type"],
            "move"
        );
        for side in ["a", "b"] {
            let observed = &value[side]["execution"]["decision"]["memoryPatch"]["set"]["observed"];
            assert_eq!(observed["owner"], owner);
            assert_eq!(observed["memoryKeys"], json!([]));
            assert_eq!(observed["taskIds"], json!([format!("{owner}-task")]));
            assert!(value[side]["sourceHash"].is_string());
        }
    }
    let unauthorized = preview(
        State(store.clone()),
        Path("compare".into()),
        headers("other-session"),
        Json(request(index)),
    )
    .await
    .unwrap_err();
    assert_eq!(unauthorized.0, StatusCode::UNAUTHORIZED);
    let invalid = preview(
        State(store.clone()),
        Path("compare".into()),
        headers("one"),
        Json(request(index + 100)),
    )
    .await
    .unwrap_err();
    assert_eq!(invalid.0, StatusCode::CONFLICT);
    let mut fail = match request(index) {
        PreviewRequest::Compare(r) => r,
        _ => unreachable!(),
    };
    let code = fail.a.files.get_mut("main.ts").unwrap();
    *code = code.replace(
        "const actor=",
        "if(ctx.tick>=0) throw new Error('candidate-A-failed'); const actor=",
    );
    let Json(value) = preview(
        State(store.clone()),
        Path("compare".into()),
        headers("one"),
        Json(PreviewRequest::Compare(fail)),
    )
    .await
    .unwrap();
    assert!(value["a"]["execution"]["failure"].is_object());
    assert!(value["b"]["execution"]["decision"].is_object());
    let after = store
        .with_session("compare", |s| {
            Ok(serde_json::to_value(s.checkpoint()).unwrap())
        })
        .await
        .unwrap();
    assert_eq!(before, after);
    std::fs::remove_dir_all(directory).unwrap();
}
