use super::*;
use serde_json::{json, to_value};
use std::collections::BTreeMap;

fn session() -> Session {
    let mut session = Session::new("scripted".into(), Mode::Training, 42);
    session.join("private-token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session.publish_script(
        "p1",
        PublishedScript {
            project: SourceProject {
                files: BTreeMap::from([("main.ts".into(), "source kept private".into())]),
                entry: None,
            },
            bundle: json!({"sourceHash":"hash","entry":"main.ts","code":"compiled private source"}),
        },
    );
    session
}
fn decision(intents: serde_json::Value) -> Vec<ScriptDecision> {
    vec![ScriptDecision {
        player_id: "p1".into(),
        intents: serde_json::from_value(intents).unwrap(),
        failure: None,
    }]
}
fn room(session: &mut Session, actor: &str) -> String {
    session
        .snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == actor)
        .unwrap()
        .room_id
}

#[test]
fn priority_selects_one_action_and_empty_output_holds() {
    let mut session = session();
    session.advance_scripted(decision(json!([
        {"type":"move","actorId":"p1-gatherer","roomId":"room-1","priority":5},
        {"type":"move","actorId":"p1-gatherer","roomId":"room-4","priority":10}
    ])));
    assert_eq!(room(&mut session, "p1-gatherer"), "room-4");
    assert_eq!(room(&mut session, "p1-scout"), "room-0");
    session.advance_scripted(decision(json!([])));
    assert_eq!(room(&mut session, "p1-gatherer"), "room-4");
    assert!(
        session
            .snapshot()
            .actors
            .iter()
            .all(|actor| actor.state == "idle")
    );
    assert_eq!(
        session
            .snapshot()
            .actors
            .iter()
            .find(|a| a.id == "p1-gatherer")
            .unwrap()
            .cargo,
        0
    );
}

#[test]
fn manual_action_wins_then_disable_restores_presets() {
    let mut session = session();
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-gatherer".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    session.advance_scripted(decision(json!([
        {"type":"move","actorId":"p1-gatherer","roomId":"room-4","priority":100}
    ])));
    assert_eq!(room(&mut session, "p1-gatherer"), "room-1");
    session.disable_script("p1");
    session.advance();
    assert_eq!(
        session
            .snapshot()
            .actors
            .iter()
            .find(|a| a.id == "p1-gatherer")
            .unwrap()
            .cargo,
        8
    );
    assert!(session.players["p1"].script.is_none());
}

#[test]
fn replay_uses_recorded_decisions_and_checkpoint_keeps_sources() {
    let mut session = session();
    session.advance_scripted(decision(json!([
        {"type":"move","actorId":"p1-gatherer","roomId":"room-1","priority":10}
    ])));
    session.advance_scripted(decision(json!([
        {"type":"gather","actorId":"p1-gatherer","priority":10}
    ])));
    let replay = session.export_replay().unwrap();
    assert!(!to_value(&replay).unwrap().to_string().contains("private"));
    let mut replayed = Session::from_replay(&replay).unwrap();
    assert_eq!(
        to_value(session.snapshot()).unwrap(),
        to_value(replayed.snapshot()).unwrap()
    );
    assert!(replayed.scripts.is_empty());
    let mut restored = Session::from_checkpoint(session.checkpoint()).unwrap();
    assert_eq!(
        restored.scripts["p1"].project.files["main.ts"],
        "source kept private"
    );
    assert_eq!(restored.tokens["private-token"], "p1");
    let next = decision(json!([{"type":"gather","actorId":"p1-gatherer","priority":10}]));
    session.advance_scripted(next.clone());
    restored.advance_scripted(next);
    assert_eq!(
        to_value(session.snapshot()).unwrap(),
        to_value(restored.snapshot()).unwrap()
    );
}

#[test]
fn reset_retains_script_and_rule_command_switches_to_preset() {
    let mut session = session();
    session.advance_scripted(decision(json!([])));
    session.command("p1", Command::Reset {}).unwrap();
    assert!(session.players["p1"].script.is_some());
    assert!(session.scripts.contains_key("p1"));
    let replay = session.export_replay().unwrap();
    assert!(
        Session::from_replay(&replay).unwrap().players["p1"]
            .script
            .is_some()
    );
    session
        .command(
            "p1",
            Command::Rule {
                preset: "explore".into(),
                retreat_hp: 40,
            },
        )
        .unwrap();
    assert!(session.players["p1"].script.is_none());
    assert!(session.scripts.is_empty());
    session.advance();
    assert_eq!(room(&mut session, "p1-scout"), "room-5");
}
