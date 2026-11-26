use crate::{ResultSummary, Session};
impl Session {
    pub(crate) fn contest_tick(&mut self) {
        self.control_points_tick();
        let config = super::scenario::config();
        self.scenario.remaining_ticks = config["durationTicks"]
            .as_u64()
            .unwrap()
            .saturating_sub(self.tick);
        let goal = config["exclusiveScoreTicks"].as_u64().unwrap() as u32;
        let leader = self.players.values().map(|p| p.score).max().unwrap_or(0);
        if leader >= goal || self.scenario.remaining_ticks == 0 {
            let leaders: Vec<_> = self
                .players
                .values()
                .filter(|p| p.score == leader)
                .collect();
            let winner = if leaders.len() == 1 {
                leaders[0].id.clone()
            } else {
                String::new()
            };
            let reason = if leader >= goal {
                "独占书印累计20拍，演练胜利"
            } else if winner.is_empty() {
                "演练限时结束，同分平局"
            } else {
                "演练限时结束，比分领先"
            };
            self.result = Some(ResultSummary {
                winner,
                reason: reason.into(),
            });
            self.paused = true;
            self.event("settlement", reason.into(), None);
        }
    }
}
