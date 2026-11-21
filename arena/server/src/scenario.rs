use crate::{Actor, Enemy, ResultSummary, Session};
pub fn config() -> &'static serde_json::Value {
    static CONFIG: std::sync::OnceLock<serde_json::Value> = std::sync::OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(include_str!("../../shared/first-expedition.json")).unwrap()
    })
}
pub fn number(key: &str) -> u64 {
    config()[key].as_u64().unwrap()
}
impl Session {
    pub(crate) fn scenario_tick(&mut self) {
        self.scenario.remaining_ticks = number("durationTicks").saturating_sub(self.tick);
        let target = config()["targetRoomId"].as_str().unwrap().to_string();
        let catalog = self
            .buildings
            .iter()
            .find(|b| {
                b.room_id == target
                    && b.kind == "catalog"
                    && b.hp > 0
                    && b.construction_ticks >= b.required_ticks
            })
            .cloned();
        let occupied = catalog.as_ref().is_some_and(|b| {
            self.world.query::<&Actor>().iter(&self.world).any(|a| {
                a.hp > 0
                    && a.travel.is_none()
                    && !a.retreating
                    && a.room_id == target
                    && a.owner == b.owner
            })
        });
        self.scenario.blocked_reason = if catalog.is_none() {
            Some("请在遗失书库建设编目台".into())
        } else if self.enemies.iter().any(|e| e.hp > 0 && e.room_id == target) {
            Some("守卫存活，编目暂停".into())
        } else if !occupied {
            Some("需有存活队员驻守编目台".into())
        } else {
            None
        };
        if self.scenario.blocked_reason.is_none() {
            self.scenario.report.catalog_ticks += 1;
            if self.scenario.report.catalog_ticks.is_multiple_of(2) {
                self.scenario.catalog_progress += 1;
                if let Some(b) = &catalog {
                    self.players.get_mut(&b.owner).unwrap().score = self.scenario.catalog_progress;
                }
            }
        }
        if self.scenario.catalog_progress >= number("counterattackProgress") as u32
            && self.scenario.counterattack_tick.is_none()
        {
            self.scenario.counterattack_tick = Some(self.tick + number("counterattackDelayTicks"));
            self.event(
                "counterattack-warning",
                "编目30：10秒后墨影反扑，准备防御或撤退".into(),
                None,
            );
        }
        if !self.scenario.counterattack_spawned
            && self
                .scenario
                .counterattack_tick
                .is_some_and(|t| self.tick >= t)
        {
            self.scenario.counterattack_spawned = true;
            let position = crate::Position { x: -8., y: 0. };
            let travel = crate::Travel {
                travel_id: format!("counterattack-{}", self.tick),
                target_room_id: target.clone(),
                path: vec![position, crate::travel::center(&target)],
                segment: 0,
                distance_milli: 0,
                total_distance_milli: 8000,
                started_tick: self.tick,
                speed_milli_per_tick: number("speedMilliPerTick"),
                progress: 0.,
            };
            self.enemies.push(Enemy {
                action_cue: None,
                id: "guardian-counterattack".into(),
                room_id: "room-4".into(),
                hp: number("enemyHp") as u32,
                max_hp: number("enemyHp") as u32,
                world_position: position,
                state: "advancing".into(),
                action_tick: self.tick,
                travel: Some(travel),
            });
            self.event("counterattack", "反扑守卫从西侧路口推进".into(), None);
        }
        let alive = self
            .world
            .query::<&Actor>()
            .iter(&self.world)
            .any(|a| a.hp > 0);
        let outcome = if !self.players.is_empty() && !alive {
            Some((String::new(), "全队倒地，远征失败"))
        } else if self.scenario.catalog_progress >= number("catalogGoal") as u32 {
            Some((
                catalog.map(|b| b.owner).unwrap_or_default(),
                "编目60完成且小队存活，远征胜利",
            ))
        } else if self.scenario.remaining_ticks == 0 {
            Some((String::new(), "8分钟结束，编目不足60，远征失败"))
        } else {
            None
        };
        if let Some((winner, reason)) = outcome {
            self.result = Some(ResultSummary {
                winner,
                reason: reason.into(),
            });
            self.paused = true;
            self.event("settlement", reason.into(), None);
        }
    }
}
