use crate::{Appearance, ReplayOperation, types::*};
use bevy_ecs::prelude::World;
use std::collections::BTreeMap;

pub struct Session {
    pub simulation_version: u32,
    pub scenario: Scenario,
    pub enemies: Vec<Enemy>,
    pub rule_runtime: BTreeMap<String, crate::script_state::RuleRuntimeState>,
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
    pub scripts: BTreeMap<String, crate::PublishedScript>,
    pub(crate) script_versions: crate::RuleVersionCatalog,
    pub(crate) world: World,
    pub(crate) next_event: u64,
    pub(crate) manual_actions: BTreeMap<String, u64>,
    pub(crate) replay_operations: Vec<ReplayOperation>,
    pub(crate) replay_overflowed: bool,
}
impl Session {
    /// Historical v0.2 simulation, retained solely for replay compatibility.
    pub fn new_legacy(id: String, mode: Mode, seed: u64) -> Self {
        let mut session = Self::new(id, mode, seed);
        session.configure_replay_version(0);
        session
    }

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
                    crate::scenario::number("initialResourceBase") as u32
                        + (seed % crate::scenario::number("initialResourceVariance")) as u32
                } else {
                    0
                },
                enemy_hp: if i == 3 {
                    crate::scenario::number("enemyHp") as u32
                } else {
                    0
                },
                owner: None,
            })
            .collect();
        Self {
            simulation_version: 4,
            scenario: Scenario {
                remaining_ticks: crate::scenario::number("durationTicks"),
                ..Default::default()
            },
            enemies: vec![Enemy {
                last_moved_tick: 0,
                action_cue: None,
                impact_cue: None,
                motion_distance_milli: 0,
                last_move_direction: crate::action_runtime::default_direction(),
                id: "guardian-1".into(),
                room_id: "room-3".into(),
                hp: crate::scenario::number("enemyHp") as u32,
                max_hp: crate::scenario::number("enemyHp") as u32,
                world_position: crate::travel::center("room-3"),
                state: "guarding".into(),
                action_tick: 0,
                travel: None,
            }],
            id,
            mode,
            seed,
            tick: 0,
            paused: mode == Mode::Training,
            players: BTreeMap::new(),
            tokens: BTreeMap::new(),
            rooms,
            buildings: vec![],
            events: vec![],
            result: None,
            scripts: BTreeMap::new(),
            script_versions: BTreeMap::new(),
            rule_runtime: BTreeMap::new(),
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
                materials: if self.simulation_version >= 3 {
                    crate::scenario::number("initialMaterials") as u32
                } else {
                    40
                },
                score: 0,
                rule: Rule {
                    preset: "gather".into(),
                    retreat_hp: if self.simulation_version >= 3 {
                        crate::scenario::number("retreatHp") as u32
                    } else {
                        30
                    },
                },
                script: None,
            },
        );
        self.tokens.insert(token, id.clone());
        for role in ["scout", "gatherer", "guard"] {
            self.world.spawn(Actor {
                last_moved_tick: 0,
                pending_delivery: false,
                action_cue: None,
                impact_cue: None,
                motion_distance_milli: 0,
                last_move_direction: crate::action_runtime::default_direction(),
                id: format!("{id}-{role}"),
                owner: id.clone(),
                role: role.into(),
                room_id: "room-0".into(),
                hp: crate::scenario::number("actorHp") as u32,
                max_hp: crate::scenario::number("actorHp") as u32,
                state: "idle".into(),
                cargo: 0,
                cargo_capacity: if role == "gatherer" {
                    crate::scenario::number("gathererCapacity") as u32
                } else {
                    crate::scenario::number("actorCapacity") as u32
                },
                appearance: Appearance::for_role(role),
                world_position: if self.simulation_version >= 3 {
                    crate::travel::slot("room-0", role, &id)
                } else {
                    Position::default()
                },
                travel: None,
                task: None,
                action_tick: 0,
                retreating: false,
            });
        }
        if self.simulation_version >= 3 {
            for kind in ["core", "warehouse"] {
                self.buildings.push(Building {
                    world_position: crate::travel::build_anchor("room-0", kind),
                    id: format!("{id}-base-{kind}"),
                    owner: id.clone(),
                    room_id: "room-0".into(),
                    kind: kind.into(),
                    hp: crate::scenario::number("actorHp") as u32,
                    max_hp: crate::scenario::number("actorHp") as u32,
                    construction_ticks: 0,
                    required_ticks: 0,
                });
            }
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
        if self.simulation_version < 3 {
            for a in &mut actors {
                a.world_position = crate::travel::center(&a.room_id);
            }
        }
        Snapshot {
            simulation_version: self.simulation_version,
            map_version: if self.simulation_version >= 3 {
                crate::travel::world_map()["version"]
                    .as_str()
                    .unwrap()
                    .into()
            } else {
                String::new()
            },
            tick_duration_ms: if self.simulation_version >= 3 {
                crate::scenario::number("tickDurationMs") as u32
            } else {
                0
            },
            world_map: if self.simulation_version >= 3 {
                crate::travel::world_map().clone()
            } else {
                serde_json::Value::Null
            },
            scenario_config: if self.simulation_version >= 3 {
                crate::scenario::config().clone()
            } else {
                serde_json::Value::Null
            },
            scenario: self.scenario.clone(),
            enemies: self.enemies.clone(),
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
            buildings: self
                .buildings
                .iter()
                .cloned()
                .map(|mut b| {
                    if self.simulation_version < 3 {
                        b.world_position = crate::travel::center(&b.room_id);
                    }
                    b
                })
                .collect(),
            events: self.events.clone(),
            result: self.result.clone(),
        }
    }
}
