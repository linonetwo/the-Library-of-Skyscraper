use super::*;
use skyscraper_arena_server::{Mode, PublishedScript, Session, SourceProject};
use std::collections::BTreeMap;

#[tokio::test]
async fn authenticated_version_reads_and_rollback_are_owner_scoped() {
    let directory =
        std::env::temp_dir().join(format!("arena-version-routes-{}", uuid::Uuid::new_v4()));
    let store = Store::open(directory.clone()).unwrap();
    let mut session = Session::new("versions".into(), Mode::Online, 42);
    session.join("one".into()).unwrap();
    session.join("two".into()).unwrap();
    session.publish_script(
        "p1",
        PublishedScript {
            project: SourceProject {
                files: BTreeMap::from([("main.ts".into(), "private source".into())]),
                entry: None,
            },
            bundle: json!({"sourceHash":"A","entry":"main.ts","code":"private code"}),
        },
    );
    store.insert(session).await;
    let mut p1 = HeaderMap::new();
    p1.insert("authorization", "Bearer one".parse().unwrap());
    let mut p2 = HeaderMap::new();
    p2.insert("authorization", "Bearer two".parse().unwrap());
    let Json(list) = versions(State(store.clone()), Path("versions".into()), p1.clone())
        .await
        .unwrap();
    assert_eq!(list.active_source_hash.as_deref(), Some("A"));
    let Json(detail) = version(
        State(store.clone()),
        Path(("versions".into(), "A".into())),
        p1.clone(),
    )
    .await
    .unwrap();
    assert_eq!(detail["project"]["files"]["main.ts"], "private source");
    assert!(detail.get("bundle").is_none());
    let err = version(
        State(store.clone()),
        Path(("versions".into(), "A".into())),
        p2.clone(),
    )
    .await
    .unwrap_err();
    assert_eq!(err.0, StatusCode::NOT_FOUND);
    let err = rollback(
        State(store.clone()),
        Path("versions".into()),
        p2,
        Json(Rollback {
            source_hash: "A".into(),
        }),
    )
    .await
    .unwrap_err();
    assert_eq!(err.0, StatusCode::NOT_FOUND);
    store
        .edit_player("versions", &p1, |session, owner| {
            session.disable_script(owner);
            Ok(())
        })
        .await
        .unwrap();
    let Json(snapshot) = rollback(
        State(store.clone()),
        Path("versions".into()),
        p1,
        Json(Rollback {
            source_hash: "A".into(),
        }),
    )
    .await
    .unwrap();
    assert_eq!(
        snapshot.players[0].script.as_ref().unwrap().source_hash,
        "A"
    );
    std::fs::remove_dir_all(directory).unwrap();
}
