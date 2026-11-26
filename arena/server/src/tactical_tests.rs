//! Explicit fixed-world unit fixtures are separate from the command-only replay cases.
use crate::*;
use bevy_ecs::prelude::Entity;
fn game(mode: Mode) -> Session {
    let mut s = Session::new_scenario("tactical".into(), mode, 42, ScenarioId::SealContest);
    s.join("first-token".into()).unwrap();
    if mode == Mode::Online {
        s.join("second-token".into()).unwrap();
    }
    s
}
fn place(s: &mut Session, id: &str, room: &str, x: f64, y: f64) {
    let entity = s
        .world
        .query::<(Entity, &Actor)>()
        .iter(&s.world)
        .find(|(_, a)| a.id == id)
        .unwrap()
        .0;
    let mut a = s.world.get_mut::<Actor>(entity).unwrap();
    a.room_id = room.into();
    a.world_position = Position { x, y };
    a.travel = None;
    a.task = None;
    a.retreating = false;
}
fn actor(s: &mut Session, id: &str) -> Actor {
    s.snapshot()
        .actors
        .into_iter()
        .find(|a| a.id == id)
        .unwrap()
}
fn attack(s: &mut Session, id: &str, target: &str) {
    s.command(
        "p1",
        Command::Attack {
            actor_id: id.into(),
            target_id: Some(target.into()),
        },
    )
    .unwrap();
}
fn repair(s: &mut Session, id: &str, building: &str) {
    s.command(
        "p1",
        Command::Repair {
            actor_id: id.into(),
            building_id: building.into(),
        },
    )
    .unwrap();
}
fn claim(s: &mut Session, owner: &str, id: &str) {
    s.command(
        owner,
        Command::Claim {
            actor_id: id.into(),
            room_id: "room-2".into(),
        },
    )
    .unwrap();
}
fn result(s: &Session) -> &TacticalEvent {
    s.events.last().unwrap().tactical.as_ref().unwrap()
}
#[path = "tactical_attack_tests.rs"]
mod attack_tests;
#[path = "tactical_claim_tests.rs"]
mod claim_tests;
#[path = "tactical_repair_tests.rs"]
mod repair_tests;
#[path = "tactical_replay_tests.rs"]
mod replay_tests;
