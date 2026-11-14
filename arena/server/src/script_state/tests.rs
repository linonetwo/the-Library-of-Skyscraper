use super::*;
#[cfg(test)]
mod version_tests {
    use super::*;
    use crate::{Mode, ScriptDecision};
    fn decision(owner: &str, hash: &str, patch: Value) -> ScriptDecision {
        ScriptDecision {
            player_id: owner.into(),
            source_hash: Some(hash.into()),
            memory_patch: Some(patch),
            task_patches: None,
            intents: vec![],
            failure: None,
        }
    }
    #[test]
    fn version_owner_checkpoint_reset_and_atomicity() {
        let mut s = Session::new("runtime".into(), Mode::Online, 1);
        s.join("one".into()).unwrap();
        s.join("two".into()).unwrap();
        s.advance_scripted(vec![
            decision("p1", "a", json!({"set":{"n":1}})),
            decision("p2", "a", json!({"set":{"n":8}})),
        ]);
        s.advance_scripted(vec![decision("p1", "b", json!({"set":{"n":2}}))]);
        assert_eq!(s.rule_state("p1", Some("a"))["memory"]["n"], 1);
        assert_eq!(s.rule_state("p2", Some("a"))["memory"]["n"], 8);
        let mut bad = decision("p1", "a", json!({"set":{"n":9}}));
        bad.task_patches = Some(vec![
            json!({"type":"upsert","task":{"id":"bad","actorId":"p2-scout"}}),
        ]);
        s.advance_scripted(vec![bad]);
        assert_eq!(s.rule_state("p1", Some("a"))["memory"]["n"], 1);
        let mut restored = Session::from_checkpoint(s.checkpoint()).unwrap();
        assert_eq!(
            restored.rule_state("p1", Some("a")),
            s.rule_state("p1", Some("a"))
        );
        let replay = s.export_replay_for(Some("p1")).unwrap();
        let encoded = serde_json::to_value(&replay).unwrap();
        assert!(
            encoded["operations"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|op| op["type"] == "scriptAdvance")
                .all(|op| op["decisions"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|d| d["playerId"] == "p2")
                    .all(|d| d.get("memoryPatch").is_none()))
        );
        Session::from_replay(&replay).unwrap();
        restored.rule_runtime.clear();
        assert_eq!(restored.rule_state("p1", Some("a"))["memory"], json!({}));
    }
}

#[cfg(test)]
mod queue_tests {
    use super::*;
    use crate::{Command, Mode};
    #[test]
    fn ordered_tasks_quotas_reset_and_private_snapshot() {
        let mut s = Session::new("tasks".into(), Mode::Training, 1);
        s.join("token".into()).unwrap();
        let task = json!({"id":"x","actorId":"p1-scout","roomId":"room-0","kind":"gather","priority":1,"status":"queued","blockedReason":null});
        let mut d = ScriptDecision {
            player_id: "p1".into(),
            source_hash: Some("a".into()),
            memory_patch: Some(json!({"set":{"private-secret":1}})),
            task_patches: Some(vec![
                json!({"type":"upsert","task":task}),
                json!({"type":"remove","taskId":"x"}),
                json!({"type":"upsert","task":task}),
            ]),
            intents: vec![],
            failure: None,
        };
        s.advance_scripted(vec![d.clone()]);
        assert_eq!(
            s.rule_state("p1", Some("b"))["tasks"]["items"][0]["sourceHash"],
            "a"
        );
        assert!(
            !serde_json::to_string(&s.snapshot())
                .unwrap()
                .contains("private-secret")
        );
        d.task_patches = Some(vec![json!({"type":"remove","taskId":"x"}); 33]);
        d.memory_patch = Some(json!({"set":{"private-secret":2}}));
        s.advance_scripted(vec![d.clone()]);
        assert_eq!(s.rule_state("p1", Some("a"))["memory"]["private-secret"], 1);
        d.task_patches = None;
        d.memory_patch = Some(json!({"set":{"huge":"x".repeat(65536)}}));
        s.advance_scripted(vec![d]);
        assert!(
            s.rule_state("p1", Some("a"))["memory"]
                .get("huge")
                .is_none()
        );
        s.command("p1", Command::Reset {}).unwrap();
        assert_eq!(s.rule_state("p1", Some("a"))["memory"], json!({}));
        assert_eq!(s.rule_state("p1", Some("a"))["tasks"]["items"], json!([]));
    }
}

#[test]
fn typed_patch_schema_preserves_missing_and_null_semantics() {
    assert!(serde_json::from_value::<RuleMemoryPatch>(json!({})).is_ok());
    assert!(serde_json::from_value::<RuleMemoryPatch>(json!({"set":null})).is_err());
    assert!(serde_json::from_value::<RuleMemoryPatch>(json!({"remove":null})).is_err());
    let mut task = json!({"id":"x","actorId":"p1-scout","roomId":"room-0","kind":"move","priority":1,"status":"queued","blockedReason":null});
    assert!(serde_json::from_value::<crate::script_tasks::TaskDraft>(task.clone()).is_ok());
    task.as_object_mut().unwrap().remove("blockedReason");
    assert!(serde_json::from_value::<crate::script_tasks::TaskDraft>(task).is_err());
}
