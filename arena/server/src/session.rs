use crate::{Appearance, ReplayOperation, types::*};
use bevy_ecs::prelude::World;
use std::collections::BTreeMap;

pub struct Session {
    pub id: String,
    pub mode: Mode,
    pub seed: u64,
    pub tick: u64,
    pub paused: bool,
    pub players: BTreeMap<String, Player>,
    pub tokens: BTreeMap<String, String>,
    pub rooms: Vec<Room>,
    pub buildings: Vec<Building>,
    pub events: Vec<Event>,
    pub result: Option<ResultSummary>,
    pub(crate) world: World,
    pub(crate) next_event: u64,
    pub(crate) manual_actions: BTreeMap<String, u64>,
    pub(crate) replay_operations: Vec<ReplayOperation>,
    pub(crate) replay_overflowed: bool,
}
impl Session {
    pub fn new(id: String, mode: Mode, seed: u64) -> Self {
        let names = [
            "归档中庭",
            "琥珀纸林",
            "星砂编目台",
            "遗失书库",
            "墨晶回廊",
            "月灯书架",
            "旧日索引",
        ];
        let kinds = [
            "base", "resource", "catalog", "ruins", "resource", "catalog", "ruins",
        ];
        let coords = [(0, 0), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)];
        let rooms = coords
            .iter()
            .enumerate()
            .map(|(i, (q, r))| Room {
                id: format!("room-{i}"),
                q: *q,
                r: *r,
                name: names[i].into(),
                kind: kinds[i].into(),
                resources: if kinds[i] == "resource" {
                    160 + (seed % 41) as u32
                } else {
                    0
                },
                enemy_hp: if kinds[i] == "ruins" {
                    60 + (seed % 21) as u32
                } else {
                    0
                },
                owner: None,
            })
            .collect();
        Self {
            id,
            mode,
            seed,
            tick: 0,
            paused: false,
            players: BTreeMap::new(),
            tokens: BTreeMap::new(),
            rooms,
            buildings: vec![],
            events: vec![],
            result: None,
            world: World::new(),
            next_event: 1,
            manual_actions: BTreeMap::new(),
            replay_operations: vec![],
            replay_overflowed: false,
        }
    }
    pub fn join(&mut self, token: String) -> Result<String, String> {
        if self.players.len() >= if self.mode == Mode::Training { 1 } else { 4 } {
            return Err("session full".into());
        }
        if self.result.is_some() {
            return Err("session settled".into());
        }
        let id = format!("p{}", self.players.len() + 1);
        self.players.insert(
            id.clone(),
            Player {
                id: id.clone(),
                name: format!("司书 {}", self.players.len() + 1),
                materials: 40,
                score: 0,
                rule: Rule {
                    preset: "gather".into(),
                    retreat_hp: 30,
                },
            },
        );
        self.tokens.insert(token, id.clone());
        for role in ["scout", "gatherer", "guard"] {
            self.world.spawn(Actor {
                id: format!("{id}-{role}"),
                owner: id.clone(),
                role: role.into(),
                room_id: "room-0".into(),
                hp: 100,
                max_hp: 100,
                state: "idle".into(),
                cargo: 0,
                cargo_capacity: if role == "gatherer" { 24 } else { 12 },
                appearance: Appearance::for_role(role),
            });
        }
        self.event("join", format!("{id} 的三人小队抵达中庭"), Some(&id));
        self.record_operation(ReplayOperation::Join {
            player_id: id.clone(),
        });
        Ok(id)
    }
    pub(crate) fn event(&mut self, kind: &str, message: String, player: Option<&str>) {
        self.events.push(Event {
            id: self.next_event,
            tick: self.tick,
            kind: kind.into(),
            message,
            player_id: player.map(str::to_owned),
        });
        self.next_event += 1;
        if self.events.len() > 100 {
            self.events.remove(0);
        }
    }
    pub fn snapshot(&mut self) -> Snapshot {
        let mut query = self.world.query::<&Actor>();
        let mut actors: Vec<_> = query.iter(&self.world).cloned().collect();
        actors.sort_by(|a, b| a.id.cmp(&b.id));
        Snapshot {
            session_id: self.id.clone(),
            mode: self.mode,
            seed: self.seed,
            tick: self.tick,
            paused: self.paused,
            phase: if self.result.is_some() {
                "settled"
            } else {
                "running"
            }
            .into(),
            rooms: self.rooms.clone(),
            players: self.players.values().cloned().collect(),
            actors,
            buildings: self.buildings.clone(),
            events: self.events.clone(),
            result: self.result.clone(),
        }
    }
}
