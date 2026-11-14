use super::*;

fn session() -> Session {
    let mut session = Session::new("wardrobe".into(), Mode::Online, 42);
    session.join("first".into()).unwrap();
    session.join("second".into()).unwrap();
    session
}

fn outfit() -> Appearance {
    Appearance {
        outfit: Outfit::Warden,
        hair: Hair::Midnight,
        weapon: false,
    }
}

fn equip(actor_id: &str) -> Command {
    Command::Equip {
        actor_id: actor_id.into(),
        appearance: outfit(),
    }
}

fn actor(session: &mut Session, id: &str) -> Actor {
    session
        .snapshot()
        .actors
        .into_iter()
        .find(|actor| actor.id == id)
        .unwrap()
}

#[test]
fn appearance_defaults_and_two_player_ownership() {
    let mut session = session();
    assert_eq!(
        actor(&mut session, "p1-guard").appearance,
        Appearance::for_role("guard")
    );
    session.command("p1", equip("p1-scout")).unwrap();
    assert_eq!(actor(&mut session, "p1-scout").appearance, outfit());
    assert_eq!(
        actor(&mut session, "p2-scout").appearance,
        Appearance::for_role("scout")
    );
    assert!(session.command("p2", equip("p1-gatherer")).is_err());
    session.command("p2", equip("p2-gatherer")).unwrap();
    assert_eq!(actor(&mut session, "p2-gatherer").appearance, outfit());
}

#[test]
fn equipment_has_its_own_lane_alongside_tactical_actions() {
    let mut session = session();
    session.command("p1", equip("p1-scout")).unwrap();
    session
        .command(
            "p1",
            Command::Move {
                actor_id: "p1-scout".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
    session.command("p1", equip("p1-scout")).unwrap();
    assert_eq!(session.tick, 0);
    assert_eq!(session.manual_actions["p1-scout"], 0);
    let mut query = session.world.query::<&mut Actor>();
    query
        .iter_mut(&mut session.world)
        .find(|actor| actor.id == "p1-scout")
        .unwrap()
        .hp = 0;
    session.command("p1", equip("p1-scout")).unwrap();
    assert_eq!(actor(&mut session, "p1-scout").appearance, outfit());
}

#[test]
fn appearance_protocol_and_replay_preserve_full_outfit() {
    let mut session = session();
    let command = serde_json::json!({
        "type": "equip",
        "actorId": "p1-scout",
        "appearance": {"outfit": "warden", "hair": "midnight", "weapon": false}
    });
    session
        .command("p1", serde_json::from_value(command.clone()).unwrap())
        .unwrap();
    assert_eq!(serde_json::to_value(equip("p1-scout")).unwrap(), command);
    session.advance();
    let replay = session.export_replay().unwrap();
    let mut restored = Session::from_replay(&replay).unwrap();
    assert_eq!(actor(&mut restored, "p1-scout").appearance, outfit());
    assert_eq!(
        serde_json::to_value(session.snapshot()).unwrap(),
        serde_json::to_value(restored.snapshot()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(&replay.timeline().unwrap().frames.last().unwrap().snapshot).unwrap(),
        serde_json::to_value(restored.snapshot()).unwrap()
    );
}
