use crate::*;
use serde_json::json;

fn session() -> Session {
    let mut session = Session::new("run".into(), Mode::Training, 42);
    session.join("token".into()).unwrap();
    session
        .command("p1", Command::Pause { paused: true })
        .unwrap();
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-scout".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    session.command("p1", Command::Step { ticks: 1 }).unwrap();
    session
}
fn run(via: &str, to: &str) -> Command {
    Command::Run {
        actor_id: "p1-scout".into(),
        via_room_id: via.into(),
        room_id: to.into(),
    }
}
fn scout(session: &mut Session) -> Actor {
    session
        .snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == "p1-scout")
        .unwrap()
}
#[test]
fn run_validates_entire_route_before_committing_and_consumes_one_turn() {
    let mut s = session();
    let before = serde_json::to_value(s.snapshot()).unwrap();
    for (via, to) in [
        ("missing", "room-4"),
        ("room-0", "missing"),
        ("room-1", "room-4"),
        ("room-0", "room-1"),
        ("room-0", "room-2"),
        ("room-3", "room-4"),
        ("room-2", "room-4"),
        ("room-0", "room-0"),
    ] {
        assert!(s.command("p1", run(via, to)).is_err(), "{via} {to}");
        assert_eq!(serde_json::to_value(s.snapshot()).unwrap(), before);
    }
    s.command("p1", run("room-0", "room-4")).unwrap();
    let actor = scout(&mut s);
    assert_eq!(actor.room_id, "room-4");
    assert_eq!(actor.cargo, 0);
    assert_eq!(
        serde_json::to_value(&actor.last_movement).unwrap(),
        json!({"kind":"run","fromRoomId":"room-1","viaRoomId":"room-0","toRoomId":"room-4","tick":1})
    );
    assert!(
        s.command(
            "p1",
            Command::Move {
                actor_id: actor.id.clone(),
                room_id: "room-0".into()
            }
        )
        .is_err()
    );
    assert!(s.command("p1", run("room-0", "room-1")).is_err());
    s.command("p1", Command::Step { ticks: 1 }).unwrap();
    assert_eq!(
        serde_json::to_value(scout(&mut s)).unwrap(),
        serde_json::to_value(actor).unwrap()
    );
}
#[test]
fn run_checks_owner_and_life_and_skips_intermediate_room_effects() {
    let mut s = session();
    s.mode = Mode::Online;
    s.join("other".into()).unwrap();
    assert!(s.command("p2", run("room-0", "room-4")).is_err());
    let (entity, mut actor) = s.actor("p1", "p1-scout").unwrap();
    actor.hp = 0;
    s.world.entity_mut(entity).insert(actor.clone());
    assert!(s.command("p1", run("room-0", "room-4")).is_err());
    actor.hp = 100;
    actor.cargo = 5;
    s.world.entity_mut(entity).insert(actor);
    let materials = s.players["p1"].materials;
    s.command("p1", run("room-0", "room-4")).unwrap();
    assert_eq!(scout(&mut s).cargo, 5);
    assert_eq!(s.players["p1"].materials, materials);
}
#[test]
fn script_run_uses_priority_selection_and_manual_movement_wins() {
    let mut s = session();
    let decision: ScriptDecision = serde_json::from_value(json!({"playerId":"p1","intents":[
        {"type":"run","actorId":"p1-scout","viaRoomId":"room-0","roomId":"room-4","priority":20},
        {"type":"move","actorId":"p1-scout","roomId":"room-0","priority":10}
    ]}))
    .unwrap();
    s.advance_scripted(vec![decision.clone()]);
    assert_eq!(scout(&mut s).last_movement.unwrap().kind, MovementKind::Run);
    assert_eq!(scout(&mut s).room_id, "room-4");
    let mut s = session();
    s.command(
        "p1",
        Command::Move {
            actor_id: "p1-scout".into(),
            room_id: "room-2".into(),
        },
    )
    .unwrap();
    s.advance_scripted(vec![decision]);
    assert_eq!(scout(&mut s).room_id, "room-2");
    assert_eq!(
        scout(&mut s).last_movement.unwrap().kind,
        MovementKind::Walk
    );
}
#[test]
fn movement_survives_checkpoint_replay_and_legacy_missing_descriptors() {
    let mut s = session();
    s.command("p1", run("room-0", "room-4")).unwrap();
    let expected = serde_json::to_value(s.snapshot()).unwrap();
    let checkpoint = serde_json::to_vec(&s.checkpoint()).unwrap();
    let mut restored =
        Session::from_checkpoint(serde_json::from_slice(&checkpoint).unwrap()).unwrap();
    assert_eq!(serde_json::to_value(restored.snapshot()).unwrap(), expected);
    assert!(restored.command("p1", run("room-0", "room-1")).is_err());
    let replay = s.export_replay().unwrap();
    let mut tampered = replay.clone();
    tampered
        .final_snapshot
        .actors
        .iter_mut()
        .find(|a| a.id == "p1-scout")
        .unwrap()
        .last_movement
        .as_mut()
        .unwrap()
        .via_room_id = Some("room-2".into());
    assert!(Session::from_replay(&tampered).is_err());
    assert_eq!(
        serde_json::to_value(Session::from_replay(&replay).unwrap().snapshot()).unwrap(),
        expected
    );
    assert!(replay.timeline().unwrap().frames.iter().any(|frame| {
        frame.snapshot.actors.iter().any(|a| {
            a.last_movement
                .as_ref()
                .is_some_and(|m| m.kind == MovementKind::Run)
        })
    }));
    let mut old = session();
    let mut replay = serde_json::to_value(old.export_replay().unwrap()).unwrap();
    for actor in replay["finalSnapshot"]["actors"].as_array_mut().unwrap() {
        actor.as_object_mut().unwrap().remove("lastMovement");
    }
    let old_expected = replay["finalSnapshot"].clone();
    let replay = serde_json::from_value(replay).unwrap();
    assert_eq!(
        serde_json::to_value(Session::from_replay(&replay).unwrap().snapshot()).unwrap(),
        old_expected
    );
    let mut checkpoint = serde_json::to_value(old.checkpoint()).unwrap();
    for actor in checkpoint["snapshot"]["actors"].as_array_mut().unwrap() {
        actor.as_object_mut().unwrap().remove("lastMovement");
    }
    assert!(
        Session::from_checkpoint(serde_json::from_value(checkpoint).unwrap())
            .unwrap()
            .snapshot()
            .actors
            .iter()
            .all(|a| a.last_movement.is_none())
    );
}
#[test]
fn presets_transport_and_retreat_record_walk_and_same_room_keeps_tuple() {
    let mut s = session();
    let (entity, mut actor) = s.actor("p1", "p1-scout").unwrap();
    actor.hp = 20;
    s.world.entity_mut(entity).insert(actor);
    s.advance();
    let movement = scout(&mut s).last_movement.unwrap();
    assert_eq!(movement.kind, MovementKind::Walk);
    assert_eq!(movement.to_room_id, "room-0");
    s.advance();
    assert_eq!(scout(&mut s).last_movement.as_ref(), Some(&movement));
    let (entity, mut actor) = s.actor("p1", "p1-scout").unwrap();
    actor.hp = 100;
    actor.room_id = "room-1".into();
    actor.cargo = actor.cargo_capacity;
    s.world.entity_mut(entity).insert(actor);
    s.advance();
    assert_eq!(scout(&mut s).last_movement.unwrap().from_room_id, "room-1");
    let mut s = Session::new("preset".into(), Mode::Training, 42);
    s.join("token".into()).unwrap();
    s.advance();
    assert!(s.snapshot().actors.iter().all(|a| {
        a.last_movement
            .as_ref()
            .is_some_and(|m| m.kind == MovementKind::Walk && m.tick == 1)
    }));
}
