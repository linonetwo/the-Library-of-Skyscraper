use crate::*;

fn training() -> Session {
    let mut session = Session::new("economy".into(), Mode::Training, 42);
    session.join("local".into()).unwrap();
    session
}

fn gatherer(session: &mut Session) -> Actor {
    session
        .snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == "p1-gatherer")
        .unwrap()
}

fn materials(session: &mut Session) -> u32 {
    let snapshot = session.snapshot();
    snapshot.rooms.iter().map(|r| r.resources).sum::<u32>()
        + snapshot.actors.iter().map(|a| a.cargo).sum::<u32>()
        + snapshot.players.iter().map(|p| p.materials).sum::<u32>()
        + snapshot.buildings.len() as u32 * 25
}

#[test]
fn harvest_transport_deliver_then_build() {
    let mut s = training();
    let total = materials(&mut s);
    for _ in 0..4 {
        s.advance();
    }
    let loaded = gatherer(&mut s);
    assert_eq!((loaded.cargo, loaded.cargo_capacity), (24, 24));
    assert_eq!(s.players["p1"].materials, 40);
    s.advance();
    let returning = gatherer(&mut s);
    assert_eq!(returning.room_id, "room-0");
    assert_eq!(returning.state, "transporting");
    assert_eq!(returning.cargo, 24);
    s.advance();
    assert_eq!(gatherer(&mut s).cargo, 0);
    assert_eq!(s.players["p1"].materials, 64);
    assert!(s.events.iter().any(|event| event.kind == "deliver"));
    s.command(
        "p1",
        Command::Build {
            room_id: "room-0".into(),
            kind: "tower".into(),
        },
    )
    .unwrap();
    assert_eq!(s.players["p1"].materials, 39);
    assert_eq!(materials(&mut s), total);
}

#[test]
fn depleted_mine_returns_partial_load_then_retargets() {
    let mut s = training();
    s.rooms[1].resources = 10;
    for _ in 0..4 {
        s.advance();
    }
    assert_eq!(gatherer(&mut s).cargo, 10);
    assert_eq!(gatherer(&mut s).room_id, "room-0");
    s.advance();
    assert_eq!(s.players["p1"].materials, 50);
    s.advance();
    assert_eq!(gatherer(&mut s).room_id, "room-4");
}

#[test]
fn manual_delivery_uses_carried_materials() {
    let mut s = training();
    let actor_id = "p1-gatherer".to_owned();
    s.command(
        "p1",
        Command::Move {
            actor_id: actor_id.clone(),
            room_id: "room-1".into(),
        },
    )
    .unwrap();
    s.advance();
    s.command(
        "p1",
        Command::Gather {
            actor_id: actor_id.clone(),
        },
    )
    .unwrap();
    s.advance();
    s.command(
        "p1",
        Command::Move {
            actor_id: actor_id.clone(),
            room_id: "room-0".into(),
        },
    )
    .unwrap();
    s.advance();
    s.command("p1", Command::Deliver { actor_id }).unwrap();
    assert_eq!(s.players["p1"].materials, 48);
    assert_eq!(gatherer(&mut s).cargo, 0);
    assert_eq!(gatherer(&mut s).state, "delivering");
}

#[test]
fn retreat_preserves_cargo_and_unloads_at_base() {
    let mut s = training();
    s.advance();
    s.advance();
    let mut query = s.world.query::<&mut Actor>();
    let mut actor = query
        .iter_mut(&mut s.world)
        .find(|a| a.role == "gatherer")
        .unwrap();
    actor.hp = 20;
    s.advance();
    assert_eq!(gatherer(&mut s).state, "retreating");
    assert_eq!(gatherer(&mut s).cargo, 8);
    s.advance();
    assert_eq!(s.players["p1"].materials, 48);
    assert_eq!(gatherer(&mut s).cargo, 0);
}

#[test]
fn online_materials_are_conserved_through_full_match() {
    let mut s = Session::new("shared".into(), Mode::Online, 42);
    s.join("one".into()).unwrap();
    s.join("two".into()).unwrap();
    let total = materials(&mut s);
    for _ in 0..120 {
        s.advance();
        assert_eq!(materials(&mut s), total);
    }
    assert_eq!(s.snapshot().actors.len(), 6);
    assert!(s.players.values().all(|player| player.materials > 40));
}
