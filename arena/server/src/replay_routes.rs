use crate::store::{Error, Store, error};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use skyscraper_arena_server::replay::{Replay, ReplayTimeline};

pub async fn export(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Replay>, Error> {
    recording(&store, &id, &headers).await.map(Json)
}

pub async fn timeline(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ReplayTimeline>, Error> {
    let replay = recording(&store, &id, &headers).await?;
    replay
        .timeline()
        .map(Json)
        .map_err(|message| error(StatusCode::CONFLICT, &message))
}

async fn recording(store: &Store, id: &str, headers: &HeaderMap) -> Result<Replay, Error> {
    store
        .with_player(id, headers, |session, _| {
            session
                .export_replay()
                .map_err(|message| error(StatusCode::CONFLICT, &message))
        })
        .await
}
