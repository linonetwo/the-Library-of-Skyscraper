use crate::{Actor, Building, Enemy, Mode, ScenarioId, Session, TacticalActorState, TacticalState};

pub(super) fn config() -> &'static serde_json::Value {
    static CONFIG: std::sync::OnceLock<serde_json::Value> = std::sync::OnceLock::new();
    CONFIG.get_or_init(|| {
        with_attack_range(
            serde_json::from_str(include_str!("../../../shared/seal-contest-v1.json")).unwrap(),
        )
    })
}
fn with_attack_range(mut config: serde_json::Value) -> serde_json::Value {
    config["attack"] =
        serde_json::json!({"rangeMilli": crate::scenario::number("attackRange") * 1000});
    config
}
pub(super) fn number(section: &str, key: &str) -> u64 {
    config()[section][key].as_u64().unwrap()
}
impl Session {
    /// Explicit opt-in while the remaining sim8 skill domains are implemented.
    pub fn new_scenario(id: String, mode: Mode, seed: u64, scenario_id: ScenarioId) -> Self {
        let mut s = Self::new(id, mode, seed);
        s.simulation_version = 8;
        s.scenario_id = Some(scenario_id);
        s.tactics = Some(TacticalState::default());
        if scenario_id == ScenarioId::SealContest {
            s.enemies = config()["enemies"]
                .as_array()
                .unwrap()
                .iter()
                .map(|e| Enemy {
                    id: e["id"].as_str().unwrap().into(),
                    room_id: e["roomId"].as_str().unwrap().into(),
                    hp: e["hp"].as_u64().unwrap() as u32,
                    max_hp: e["hp"].as_u64().unwrap() as u32,
                    world_position: serde_json::from_value(e["position"].clone()).unwrap(),
                    last_moved_tick: 0,
                    action_cue: None,
                    impact_cue: None,
                    motion_distance_milli: 0,
                    last_move_direction: crate::action_runtime::default_direction(),
                    state: "guarding".into(),
                    action_tick: 0,
                    travel: None,
                })
                .collect();
            for point in config()["controlPoints"].as_array().unwrap() {
                s.tactics
                    .as_mut()
                    .unwrap()
                    .control_points
                    .insert(point["roomId"].as_str().unwrap().into(), Default::default());
            }
            for room in &mut s.rooms {
                room.enemy_hp = s
                    .enemies
                    .iter()
                    .filter(|e| e.room_id == room.id)
                    .map(|e| e.hp)
                    .sum();
                if room.id == "room-2" {
                    room.kind = "control".into();
                    room.name = "争夺书印".into();
                }
            }
        }
        s
    }
    pub(crate) fn scenario_config(&self) -> &'static serde_json::Value {
        if self.scenario_id == Some(ScenarioId::SealContest) {
            config()
        } else if self.simulation_version >= 8 {
            static FIRST: std::sync::OnceLock<serde_json::Value> = std::sync::OnceLock::new();
            FIRST.get_or_init(|| with_attack_range(crate::scenario::config().clone()))
        } else {
            crate::scenario::config()
        }
    }
    pub(crate) fn join_tactics(&mut self, owner: &str) {
        let ids: Vec<_> = self
            .world
            .query::<&Actor>()
            .iter(&self.world)
            .filter(|a| a.owner == owner)
            .map(|a| a.id.clone())
            .collect();
        let state = self.tactics.as_mut().unwrap();
        for id in ids {
            state.actor_states.insert(
                id,
                TacticalActorState {
                    last_energy_tick: self.tick,
                    ..Default::default()
                },
            );
        }
        if self.scenario_id == Some(ScenarioId::SealContest) {
            let facility = &config()["ownedFacilities"];
            self.buildings.push(Building {
                id: format!("{owner}-drill-warehouse"),
                owner: owner.into(),
                room_id: facility["roomId"].as_str().unwrap().into(),
                kind: facility["kind"].as_str().unwrap().into(),
                world_position: serde_json::from_value(
                    facility["positionsByJoinOrder"][self.players.len() - 1].clone(),
                )
                .unwrap(),
                hp: facility["maxHp"].as_u64().unwrap() as u32,
                max_hp: facility["maxHp"].as_u64().unwrap() as u32,
                construction_ticks: 0,
                required_ticks: 0,
            });
        }
    }
}
