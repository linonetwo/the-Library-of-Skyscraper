use super::{Error, Store, bearer, error, owner};
use axum::http::{HeaderMap, StatusCode};
use skyscraper_arena_server::{Command, Snapshot};

impl Store {
    pub async fn command(
        &self,
        id: &str,
        headers: &HeaderMap,
        command: Command,
    ) -> Result<Snapshot, Error> {
        let shared = self.entry(id).await?;
        let mut entry = shared.lock().await;
        let player = owner(&entry.session, bearer(headers))?;
        if let Command::Step { ticks } = command {
            entry
                .session
                .validate_step(ticks)
                .map_err(|message| error(StatusCode::BAD_REQUEST, &message))?;
            for _ in 0..ticks {
                crate::script_driver::advance(&mut entry.session, &self.workers).await;
                entry.dirty = true;
            }
        } else {
            entry
                .session
                .command(&player, command)
                .map_err(|message| error(StatusCode::BAD_REQUEST, &message))?;
        }
        entry.dirty = true;
        Ok(entry.session.snapshot())
    }

    pub async fn advance(&self) {
        let entries: Vec<_> = self.sessions.lock().await.values().cloned().collect();
        let mut ticks = tokio::task::JoinSet::new();
        for shared in entries {
            let workers = self.workers.clone();
            ticks.spawn(async move {
                let mut entry = shared.lock().await;
                if !entry.session.paused && entry.session.result.is_none() {
                    crate::script_driver::advance(&mut entry.session, &workers).await;
                    entry.dirty = true;
                }
            });
        }
        while let Some(result) = ticks.join_next().await {
            if let Err(error) = result {
                eprintln!("Arena tick failed: {error}");
            }
        }
    }
}
