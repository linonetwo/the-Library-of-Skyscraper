use super::*;
use serde_json::{json, to_value};
use std::collections::BTreeMap;

fn script(hash: &str, source: &str) -> PublishedScript {
    PublishedScript {
        project: SourceProject {
            files: BTreeMap::from([("main.ts".into(), source.into())]),
            entry: None,
        },
        bundle: json!({"sourceHash":hash,"entry":"main.ts","code":source}),
    }
}
fn session() -> Session {
    let mut session = Session::new("versions".into(), Mode::Training, 42);
    session.join("owner-token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session
}

#[test]
fn versions_are_immutable_and_ordered_across_reset_and_switches() {
    let mut session = session();
    session.publish_script("p1", script("A", "first source"));
    session.advance_scripted(vec![]);
    session.publish_script("p1", script("B", "second source"));
    let original = to_value(session.script_version("p1", "A").unwrap()).unwrap();
    session.publish_script("p1", script("A", "different supplied body"));
    assert_eq!(
        session.scripts["p1"].project.files["main.ts"],
        "first source"
    );
    assert_eq!(
        to_value(session.script_version("p1", "A").unwrap()).unwrap(),
        original
    );
    let list = session.script_versions("p1");
    assert_eq!(
        list.versions
            .iter()
            .map(|v| v.source_hash.as_str())
            .collect::<Vec<_>>(),
        ["B", "A"]
    );
    assert_eq!(list.versions[0].parent_source_hash.as_deref(), Some("A"));
    assert_eq!(list.active_source_hash.as_deref(), Some("A"));
    session.disable_script("p1");
    assert!(session.script_versions("p1").active_source_hash.is_none());
    assert_eq!(session.script_versions("p1").versions.len(), 2);
    session.command("p1", Command::Reset {}).unwrap();
    session.publish_script("p1", script("C", "after reset"));
    assert_eq!(
        session
            .script_versions("p1")
            .versions
            .iter()
            .map(|v| v.source_hash.as_str())
            .collect::<Vec<_>>(),
        ["C", "B", "A"]
    );
    assert_eq!(
        session
            .script_version("p1", "C")
            .unwrap()
            .metadata
            .created_at_tick,
        0
    );
}

#[test]
fn owners_have_independent_versions_and_sources() {
    let mut session = Session::new("online-versions".into(), Mode::Online, 42);
    session.join("owner-one".into()).unwrap();
    session.join("owner-two".into()).unwrap();
    session.publish_script("p1", script("A", "private p1 source"));
    assert!(session.script_version("p2", "A").is_none());
    assert!(session.rollback_script("p2", "A").is_err());
    session.publish_script("p2", script("B", "private p2 source"));
    session.disable_script("p1");
    assert_eq!(
        session.script_versions("p2").active_source_hash.as_deref(),
        Some("B")
    );
    assert_eq!(session.script_versions("p1").versions.len(), 1);
}

#[test]
fn checkpoint_migration_reset_and_replay_preserve_version_switches() {
    let mut session = session();
    session.publish_script("p1", script("A", "private source A"));
    session.publish_script("p1", script("B", "private source B"));
    session.rollback_script("p1", "A").unwrap();
    session.command("p1", Command::Reset {}).unwrap();
    let checkpoint = to_value(session.checkpoint()).unwrap();
    let mut restored =
        Session::from_checkpoint(serde_json::from_value(checkpoint.clone()).unwrap()).unwrap();
    assert_eq!(
        to_value(restored.script_versions("p1")).unwrap(),
        to_value(session.script_versions("p1")).unwrap()
    );
    restored.rollback_script("p1", "B").unwrap();
    assert_eq!(restored.scripts["p1"].bundle["code"], "private source B");
    let replay = restored.export_replay().unwrap();
    assert!(
        !to_value(&replay)
            .unwrap()
            .to_string()
            .contains("private source")
    );
    assert_eq!(
        to_value(Session::from_replay(&replay).unwrap().snapshot()).unwrap(),
        to_value(restored.snapshot()).unwrap()
    );
    let mut legacy = checkpoint;
    legacy.as_object_mut().unwrap().remove("scriptVersions");
    let migrated = Session::from_checkpoint(serde_json::from_value(legacy).unwrap()).unwrap();
    assert_eq!(migrated.script_versions("p1").versions.len(), 1);
    assert_eq!(
        migrated
            .script_version("p1", "A")
            .unwrap()
            .script
            .project
            .files["main.ts"],
        "private source A"
    );
}
