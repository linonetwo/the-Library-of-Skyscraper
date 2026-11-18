use crate::{Actor, Movement, MovementKind, Session};

impl Session {
    pub(crate) fn room_distance(&self, from: usize, to: usize) -> i32 {
        let a = &self.rooms[from];
        let b = &self.rooms[to];
        ((a.q - b.q).abs() + (a.r - b.r).abs() + ((a.q + a.r) - (b.q + b.r)).abs()) / 2
    }

    pub(crate) fn validate_run(&self, actor: &Actor, via: &str, to: &str) -> Result<(), String> {
        let from = self.room_index(&actor.room_id)?;
        let via = self.room_index(via)?;
        let to = self.room_index(to)?;
        if self.room_distance(from, via) != 1
            || self.room_distance(via, to) != 1
            || self.room_distance(from, to) != 2
        {
            return Err("run requires two adjacent edges to a destination at distance two".into());
        }
        Ok(())
    }

    /// Update only after the whole route is validated. Same-room state changes
    /// do not create a movement or replace the last actual route.
    pub(crate) fn record_movement(
        &self,
        actor: &mut Actor,
        kind: MovementKind,
        via_room_id: Option<String>,
        to_room_id: String,
    ) {
        if actor.room_id != to_room_id {
            actor.last_movement = Some(Movement {
                kind,
                from_room_id: actor.room_id.clone(),
                via_room_id,
                to_room_id: to_room_id.clone(),
                tick: self.tick,
            });
            actor.room_id = to_room_id;
        }
    }
}
