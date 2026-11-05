use crate::store::Store;
use std::time::Duration;
use tokio::task::JoinHandle;

pub fn start_clock(store: Store) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(500));
        let mut ticks = 0;
        loop {
            interval.tick().await;
            store.advance().await;
            ticks += 1;
            if ticks % 4 == 0
                && let Err(error) = store.checkpoint().await
            {
                eprintln!("Arena checkpoint failed: {error}");
            }
        }
    })
}

pub async fn shutdown(store: Store, clock: JoinHandle<()>) {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("register termination signal");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = terminate.recv() => {}
        }
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await.expect("register Ctrl+C");
    clock.abort();
    store.shutdown.send_replace(true);
}
