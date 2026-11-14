use bevy_ecs::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Training,
    Online,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub preset: String,
    pub retreat_hp: u32,
}
#[derive(Clone, Debug, Serialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub materials: u32,
    pub score: u32,
    pub rule: Rule,
}
#[derive(Component, Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    pub id: String,
    pub owner: String,
    pub role: String,
    pub room_id: String,
    pub hp: u32,
    pub max_hp: u32,
    pub state: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub q: i32,
    pub r: i32,
    pub name: String,
    pub kind: String,
    pub resources: u32,
    pub enemy_hp: u32,
    pub owner: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Building {
    pub id: String,
    pub owner: String,
    pub room_id: String,
    pub kind: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: u64,
    pub tick: u64,
    pub kind: String,
    pub message: String,
    pub player_id: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
pub struct ResultSummary {
    pub winner: String,
    pub reason: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub session_id: String,
    pub mode: Mode,
    pub seed: u64,
    pub tick: u64,
    pub paused: bool,
    pub phase: String,
    pub rooms: Vec<Room>,
    pub players: Vec<Player>,
    pub actors: Vec<Actor>,
    pub buildings: Vec<Building>,
    pub events: Vec<Event>,
    pub result: Option<ResultSummary>,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum Command {
    Move {
        #[serde(rename = "actorId")]
        actor_id: String,
        #[serde(rename = "roomId")]
        room_id: String,
    },
    Gather {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Attack {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Capture {
        #[serde(rename = "actorId")]
        actor_id: String,
    },
    Build {
        #[serde(rename = "roomId")]
        room_id: String,
        kind: String,
    },
    Rule {
        preset: String,
        #[serde(rename = "retreatHp")]
        retreat_hp: u32,
    },
    Pause {
        paused: bool,
    },
    Step {
        ticks: u32,
    },
    Reset {},
}
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
    world: World,
    next_event: u64,
    manual_actions: BTreeMap<String, u64>,
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
            });
        }
        self.event("join", format!("{id} 的三人小队抵达中庭"), Some(&id));
        Ok(id)
    }
    fn event(&mut self, kind: &str, message: String, player: Option<&str>) {
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
    fn actor(&mut self, owner: &str, id: &str) -> Result<(Entity, Actor), String> {
        self.world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .find(|(_, a)| a.id == id)
            .map(|(e, a)| (e, a.clone()))
            .ok_or("actor not found".into())
            .and_then(|(e, a)| {
                if a.owner != owner {
                    Err("actor ownership denied".into())
                } else {
                    Ok((e, a))
                }
            })
    }
    fn room_index(&self, id: &str) -> Result<usize, String> {
        self.rooms
            .iter()
            .position(|r| r.id == id)
            .ok_or("room not found".into())
    }
    pub fn command(&mut self, owner: &str, command: Command) -> Result<(), String> {
        if !self.players.contains_key(owner) {
            return Err("player not found".into());
        }
        if matches!(
            command,
            Command::Pause { .. } | Command::Step { .. } | Command::Reset {}
        ) && self.mode != Mode::Training
        {
            return Err("debug commands require training session".into());
        }
        if self.result.is_some() && !matches!(command, Command::Reset {}) {
            return Err("session settled; reset training or create a new session".into());
        }
        let action_actor = match &command {
            Command::Move { actor_id, .. }
            | Command::Gather { actor_id }
            | Command::Attack { actor_id }
            | Command::Capture { actor_id } => Some(actor_id.clone()),
            _ => None,
        };
        if let Some(actor_id) = &action_actor {
            let (_, actor) = self.actor(owner, actor_id)?;
            if actor.hp == 0 {
                return Err("actor downed".into());
            }
            if self.manual_actions.get(actor_id) == Some(&self.tick) {
                return Err("actor already acted this tick".into());
            }
        }
        match command {
            Command::Pause { paused } => self.paused = paused,
            Command::Step { ticks } => {
                if !(1..=120).contains(&ticks) {
                    return Err("ticks must be 1..120".into());
                }
                if !self.paused {
                    return Err("pause training before stepping".into());
                }
                for _ in 0..ticks {
                    self.advance();
                }
            }
            Command::Reset {} => {
                let tokens = self.tokens.clone();
                *self = Self::new(self.id.clone(), self.mode, self.seed);
                for token in tokens.keys() {
                    self.join(token.clone())?;
                }
                self.paused = true;
            }
            Command::Rule { preset, retreat_hp } => {
                if !["gather", "defend", "explore"].contains(&preset.as_str()) || retreat_hp > 100 {
                    return Err("invalid preset or retreatHp (0..100)".into());
                }
                self.players.get_mut(owner).unwrap().rule = Rule { preset, retreat_hp };
                self.event("rule", "行动规则已发布".into(), Some(owner));
            }
            Command::Move { actor_id, room_id } => {
                let (entity, mut actor) = self.actor(owner, &actor_id)?;
                let target = self.room_index(&room_id)?;
                let from = self.room_index(&actor.room_id)?;
                let a = &self.rooms[from];
                let b = &self.rooms[target];
                let distance =
                    ((a.q - b.q).abs() + (a.r - b.r).abs() + ((a.q + a.r) - (b.q + b.r)).abs()) / 2;
                if distance > 1 {
                    return Err("target must be an adjacent room".into());
                }
                actor.room_id = room_id;
                actor.state = "moving".into();
                self.world.entity_mut(entity).insert(actor);
                self.event(
                    "move",
                    format!("{actor_id} 前往 {}", self.rooms[target].name),
                    Some(owner),
                );
            }
            Command::Gather { actor_id } => {
                let (e, a) = self.actor(owner, &actor_id)?;
                self.gather(e, a)?;
            }
            Command::Attack { actor_id } => {
                let (e, a) = self.actor(owner, &actor_id)?;
                self.attack(e, a)?;
            }
            Command::Capture { actor_id } => {
                let (_, a) = self.actor(owner, &actor_id)?;
                self.capture(&a)?;
            }
            Command::Build { room_id, kind } => {
                if !["tower", "catalog"].contains(&kind.as_str()) {
                    return Err("invalid building kind".into());
                }
                let idx = self.room_index(&room_id)?;
                if self.rooms[idx].enemy_hp > 0 {
                    return Err("clear hostiles before building".into());
                }
                let present = self
                    .world
                    .query::<&Actor>()
                    .iter(&self.world)
                    .any(|a| a.owner == owner && a.room_id == room_id && a.hp > 0);
                if !present {
                    return Err("owned actor must be in room".into());
                }
                if self
                    .buildings
                    .iter()
                    .any(|b| b.room_id == room_id && b.kind == kind)
                {
                    return Err("building already exists".into());
                }
                let p = self.players.get_mut(owner).unwrap();
                if p.materials < 25 {
                    return Err("need 25 materials".into());
                }
                p.materials -= 25;
                self.buildings.push(Building {
                    id: format!("building-{}", self.buildings.len() + 1),
                    owner: owner.into(),
                    room_id,
                    kind,
                });
                self.event("build", "消耗 25 建材，建筑完工".into(), Some(owner));
            }
        }
        if let Some(actor_id) = action_actor {
            self.manual_actions.insert(actor_id, self.tick);
        }
        Ok(())
    }
    fn gather(&mut self, entity: Entity, mut actor: Actor) -> Result<(), String> {
        let idx = self.room_index(&actor.room_id)?;
        if self.rooms[idx].resources == 0 {
            return Err("no resources in this room".into());
        }
        if actor.hp == 0 {
            return Err("actor downed".into());
        }
        let amount = self.rooms[idx]
            .resources
            .min(if actor.role == "gatherer" { 8 } else { 3 });
        self.rooms[idx].resources -= amount;
        self.players.get_mut(&actor.owner).unwrap().materials += amount;
        actor.state = "gathering".into();
        self.event(
            "gather",
            format!("{} 采集 {amount} 建材", actor.id),
            Some(&actor.owner),
        );
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
    fn attack(&mut self, entity: Entity, mut actor: Actor) -> Result<(), String> {
        let idx = self.room_index(&actor.room_id)?;
        if self.rooms[idx].enemy_hp == 0 {
            return Err("no hostile in this room".into());
        }
        if actor.hp == 0 {
            return Err("actor downed".into());
        }
        let damage = if actor.role == "guard" { 18 } else { 9 };
        self.rooms[idx].enemy_hp = self.rooms[idx].enemy_hp.saturating_sub(damage);
        actor.hp = actor.hp.saturating_sub(7);
        actor.state = "fighting".into();
        self.event(
            "combat",
            format!("{} 对墨影造成 {damage} 伤害", actor.id),
            Some(&actor.owner),
        );
        if self.rooms[idx].enemy_hp == 0 {
            let owners: std::collections::BTreeSet<String> = self
                .world
                .query::<&Actor>()
                .iter(&self.world)
                .filter(|other| other.room_id == actor.room_id && other.hp > 0)
                .map(|other| other.owner.clone())
                .collect();
            let share = 15 / owners.len().max(1) as u32;
            for owner in &owners {
                self.players.get_mut(owner).unwrap().score += share;
            }
            self.event(
                "defeat",
                format!("墨影消散，在场小队各获得 {share} 编目分"),
                Some(&actor.owner),
            );
        }
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
    fn capture(&mut self, actor: &Actor) -> Result<(), String> {
        let idx = self.room_index(&actor.room_id)?;
        if actor.hp == 0
            || self.rooms[idx].enemy_hp > 0
            || !["catalog", "ruins"].contains(&self.rooms[idx].kind.as_str())
        {
            return Err("room cannot be catalogued".into());
        }
        if self.rooms[idx].owner.as_deref() == Some(&actor.owner) {
            return Ok(());
        }
        if self.world.query::<&Actor>().iter(&self.world).any(|other| {
            other.room_id == actor.room_id && other.hp > 0 && other.owner != actor.owner
        }) {
            return Err("room contested by another squad".into());
        }
        let first_catalogue = self.rooms[idx].owner.is_none();
        self.rooms[idx].owner = Some(actor.owner.clone());
        if first_catalogue {
            self.players.get_mut(&actor.owner).unwrap().score += 10;
        }
        self.event(
            "capture",
            format!("{} 已编目", self.rooms[idx].name),
            Some(&actor.owner),
        );
        Ok(())
    }
    pub fn advance(&mut self) {
        if self.result.is_some() {
            return;
        }
        self.tick += 1;
        let mut actors: Vec<_> = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .map(|(e, a)| (e, a.clone()))
            .collect();
        actors.sort_by(|a, b| a.1.id.cmp(&b.1.id));
        for (entity, mut a) in actors {
            // A manual action replaces, rather than supplements, this actor's next
            // autonomous turn. Commands are immediate for responsive local controls.
            if self.manual_actions.get(&a.id) == Some(&(self.tick - 1)) {
                continue;
            }
            let rule = self.players[&a.owner].rule.clone();
            if a.hp <= rule.retreat_hp || a.hp == 0 {
                a.room_id = "room-0".into();
                a.hp = (a.hp + 10).min(100);
                a.state = "retreating".into();
                self.world.entity_mut(entity).insert(a);
                continue;
            }
            let current = self.room_index(&a.room_id).unwrap();
            if self
                .buildings
                .iter()
                .any(|b| b.owner == a.owner && b.room_id == a.room_id && b.kind == "tower")
            {
                a.hp = (a.hp + 3).min(a.max_hp);
                self.world.entity_mut(entity).insert(a.clone());
            }
            if self.rooms[current].enemy_hp > 0 {
                let _ = self.attack(entity, a);
                continue;
            }
            if self.rooms[current].resources > 0
                && (a.role == "gatherer" || rule.preset == "gather")
            {
                let _ = self.gather(entity, a);
                continue;
            }
            if ["catalog", "ruins"].contains(&self.rooms[current].kind.as_str())
                && self.rooms[current].owner.as_deref() != Some(&a.owner)
            {
                let _ = self.capture(&a);
            }
            let desired = match rule.preset.as_str() {
                "defend" => 0,
                "gather" => {
                    if a.role == "gatherer" {
                        1
                    } else if a.role == "scout" {
                        2
                    } else {
                        3
                    }
                }
                _ => match a.role.as_str() {
                    "scout" => 5,
                    "guard" => 6,
                    _ => 4,
                },
            };
            if current != desired {
                // All destinations connect through the central hex; one edge per tick.
                a.room_id = format!("room-{}", if current == 0 { desired } else { 0 });
                a.state = "moving".into();
            } else {
                a.state = if rule.preset == "defend" {
                    "guarding"
                } else {
                    "idle"
                }
                .into();
            }
            self.world.entity_mut(entity).insert(a);
        }
        if self.tick.is_multiple_of(5) {
            let occupants: Vec<Actor> = self
                .world
                .query::<&Actor>()
                .iter(&self.world)
                .cloned()
                .collect();
            for room in &self.rooms {
                if let Some(owner) = &room.owner
                    && !occupants
                        .iter()
                        .any(|a| a.room_id == room.id && a.hp > 0 && &a.owner != owner)
                {
                    self.players.get_mut(owner).unwrap().score += 2;
                }
            }
            for building in &self.buildings {
                if building.kind == "catalog" {
                    self.players.get_mut(&building.owner).unwrap().score += 1;
                }
            }
        }
        if self.tick >= 120 {
            let winner = self
                .players
                .values()
                .max_by(|a, b| a.score.cmp(&b.score).then_with(|| b.id.cmp(&a.id)))
                .map(|p| p.id.clone())
                .unwrap_or_default();
            self.result = Some(ResultSummary {
                winner,
                reason: "120 tick 训练/短赛局完成，按编目分结算".into(),
            });
            self.event("settlement", "赛局结算：编目分已锁定".into(), None);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn session() -> Session {
        let mut s = Session::new("test".into(), Mode::Training, 42);
        s.join("secret".into()).unwrap();
        s
    }
    #[test]
    fn deterministic_seed_and_ticks() {
        let (mut a, mut b) = (session(), session());
        for _ in 0..120 {
            a.advance();
            b.advance();
        }
        assert_eq!(
            serde_json::to_value(a.snapshot()).unwrap(),
            serde_json::to_value(b.snapshot()).unwrap()
        );
    }
    #[test]
    fn isolated_worlds() {
        let (mut a, b) = (session(), session());
        a.advance();
        assert_eq!(b.tick, 0);
        assert_eq!(b.players["p1"].materials, 40);
    }
    #[test]
    fn cannot_overspend() {
        let mut s = session();
        s.command(
            "p1",
            Command::Build {
                room_id: "room-0".into(),
                kind: "tower".into(),
            },
        )
        .unwrap();
        assert!(
            s.command(
                "p1",
                Command::Build {
                    room_id: "room-0".into(),
                    kind: "catalog".into()
                }
            )
            .is_err()
        );
        assert_eq!(s.players["p1"].materials, 15);
    }
    #[test]
    fn combat_and_settlement() {
        let mut s = session();
        for _ in 0..120 {
            s.advance();
        }
        assert_eq!(s.rooms[3].enemy_hp, 0);
        assert!(s.players["p1"].score > 0);
        assert!(s.result.is_some());
        assert!(s.events.len() <= 100);
    }
    #[test]
    fn ownership_and_online_debug() {
        let mut s = Session::new("test".into(), Mode::Online, 42);
        s.join("a".into()).unwrap();
        s.join("b".into()).unwrap();
        assert!(
            s.command(
                "p2",
                Command::Move {
                    actor_id: "p1-scout".into(),
                    room_id: "room-1".into()
                }
            )
            .is_err()
        );
        assert!(s.command("p1", Command::Step { ticks: 1 }).is_err());
        assert!(s.command("p1", Command::Reset {}).is_err());
    }
    #[test]
    fn validate_rules_and_steps() {
        let mut s = session();
        assert!(
            s.command(
                "p1",
                Command::Rule {
                    preset: "eval".into(),
                    retreat_hp: 30
                }
            )
            .is_err()
        );
        assert!(
            s.command(
                "p1",
                Command::Rule {
                    preset: "gather".into(),
                    retreat_hp: 101
                }
            )
            .is_err()
        );
        s.paused = true;
        assert!(s.command("p1", Command::Step { ticks: 121 }).is_err());
        assert!(s.command("p1", Command::Step { ticks: 0 }).is_err());
    }
    #[test]
    fn manual_actions_are_rate_bounded() {
        let mut s = session();
        s.command(
            "p1",
            Command::Move {
                actor_id: "p1-gatherer".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
        assert!(
            s.command(
                "p1",
                Command::Gather {
                    actor_id: "p1-gatherer".into()
                }
            )
            .is_err()
        );
        s.advance();
        s.command(
            "p1",
            Command::Gather {
                actor_id: "p1-gatherer".into(),
            },
        )
        .unwrap();
        assert!(
            s.command(
                "p1",
                Command::Gather {
                    actor_id: "p1-gatherer".into()
                }
            )
            .is_err()
        );
    }
    #[test]
    fn reset_reproduces_seed_and_preserves_credentials() {
        let mut s = session();
        for _ in 0..120 {
            s.advance();
        }
        let first = serde_json::to_value(s.snapshot()).unwrap();
        s.command("p1", Command::Reset {}).unwrap();
        assert!(s.paused);
        assert_eq!(s.tokens["secret"], "p1");
        assert_eq!(s.tick, 0);
        s.command("p1", Command::Pause { paused: false }).unwrap();
        for _ in 0..120 {
            s.advance();
        }
        assert_eq!(first, serde_json::to_value(s.snapshot()).unwrap());
    }
    #[test]
    fn different_seed_changes_resources() {
        let a = session();
        let b = Session::new("test".into(), Mode::Training, 43);
        assert_ne!(a.rooms[1].resources, b.rooms[1].resources);
    }
    #[test]
    fn malformed_commands_rejected() {
        for command in [
            r#"{"type":"step","ticks":-1}"#,
            r#"{"type":"step","ticks":1.5}"#,
            r#"{"type":"step","ticks":99999999999999999999}"#,
            r#"{"type":"step","ticks":1,"arbitrary":"code"}"#,
            r#"{"type":"execute","code":"process.exit()"}"#,
        ] {
            assert!(serde_json::from_str::<Command>(command).is_err());
        }
    }
    #[test]
    fn manual_command_replaces_next_autonomous_action() {
        let mut s = session();
        s.command(
            "p1",
            Command::Move {
                actor_id: "p1-gatherer".into(),
                room_id: "room-1".into(),
            },
        )
        .unwrap();
        s.advance();
        assert_eq!(s.players["p1"].materials, 40);
        s.advance();
        assert_eq!(s.players["p1"].materials, 48);
    }
    #[test]
    fn symmetric_online_squads_cannot_steal_by_iteration_order() {
        let mut s = Session::new("test".into(), Mode::Online, 42);
        s.join("a".into()).unwrap();
        s.join("b".into()).unwrap();
        for _ in 0..120 {
            s.advance();
        }
        assert!(s.rooms[2].owner.is_none());
        assert!(s.rooms[3].owner.is_none());
        assert_eq!(s.players["p1"].score, s.players["p2"].score);
    }
}
