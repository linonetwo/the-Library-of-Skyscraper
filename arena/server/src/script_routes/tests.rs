use super::*;
use skyscraper_arena_server::{Mode, Session};

#[test]
fn context_contains_owned_squad_and_shared_world() {
    let mut session = Session::new("script-context".into(), Mode::Online, 42);
    let owner = session.join("owner-credential".into()).unwrap();
    session.join("guest-credential".into()).unwrap();
    let context = rule_context(session.snapshot(), &owner);
    assert_eq!(context["player"]["id"], owner);
    assert_eq!(context["squad"]["actors"].as_array().unwrap().len(), 3);
    assert_eq!(context["world"]["actors"].as_array().unwrap().len(), 6);
    assert!(
        context["squad"]["actors"]
            .as_array()
            .unwrap()
            .iter()
            .all(|actor| actor["owner"] == owner)
    );
    assert!(!context.to_string().contains("credential"));
}

// Requires `npm ci --prefix ../script-toolchain`; invoked explicitly in integration CI.
#[tokio::test]
#[ignore = "requires installed script-toolchain Node dependencies"]
async fn compile_route_uses_typescript_and_preserves_authority_state() {
    let directory = std::env::temp_dir().join(format!("arena-script-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("scripts".into(), Mode::Training, 42);
    session.join("script-token".into()).unwrap();
    let before = serde_json::to_value(session.snapshot()).unwrap();
    store.insert(session).await;
    let mut headers = HeaderMap::new();
    headers.insert("authorization", "Bearer script-token".parse().unwrap());
    let project = || SourceProject {
        files: BTreeMap::from([(
            "main.ts".into(),
            "import type { RuleContext } from '@skyscraper/arena-script-sdk'; \
             export function decide(ctx: RuleContext) { return { intents: [] }; }"
                .into(),
        )]),
        entry: None,
    };
    let Json(result) = compile(
        State(store.clone()),
        Path("scripts".into()),
        headers.clone(),
        Json(project()),
    )
    .await
    .unwrap();
    assert_eq!(result["diagnostics"], json!([]));
    assert!(
        result["bundle"]["code"]
            .as_str()
            .unwrap()
            .contains("__arenaRule")
    );
    let mut bad_project = project();
    bad_project.files.insert(
        "main.ts".into(),
        "export function decide() { return 1; }".into(),
    );
    let Json(preview_result) = preview(
        State(store.clone()),
        Path("scripts".into()),
        headers,
        Json(bad_project),
    )
    .await
    .unwrap();
    assert!(preview_result.get("execution").is_none());
    assert_eq!(preview_result["tick"], before["tick"]);
    assert!(
        !preview_result["compilation"]["diagnostics"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let after = store
        .with_session("scripts", |session| {
            Ok(serde_json::to_value(session.snapshot()).unwrap())
        })
        .await
        .unwrap();
    assert_eq!(before, after);
    let unauthorized = compile(
        State(store),
        Path("scripts".into()),
        HeaderMap::new(),
        Json(project()),
    )
    .await
    .unwrap_err();
    assert_eq!(unauthorized.0, StatusCode::UNAUTHORIZED);
    std::fs::remove_dir_all(directory).unwrap();
}
