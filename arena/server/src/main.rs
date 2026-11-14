use axum::{
    Json, Router,
    extract::{
        Path, Query, Request, State,
        ws::{Message, WebSocketUpgrade},
    },
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use skyscraper_arena_server::{Command, Mode, Session};
use std::time::Duration;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

mod lifecycle;
mod persistence;
mod replay_routes;
mod script_routes;
mod store;
use store::{Error, Store, error};
const ALLOWED_ORIGINS: [&str; 6] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8787",
    "http://127.0.0.1:8787",
];
fn origin_allowed(headers: &HeaderMap) -> bool {
    // CLI/MCP clients do not send Origin. Browser origins must match exactly:
    // suffix matching would admit malicious origins such as localhost.attacker.tld.
    headers.get_all(header::ORIGIN).iter().all(|value| {
        value
            .to_str()
            .is_ok_and(|origin| ALLOWED_ORIGINS.contains(&origin))
    })
}
async fn guard_origin(State(port): State<u16>, request: Request, next: Next) -> Response {
    if !origin_allowed(request.headers()) {
        return error(StatusCode::FORBIDDEN, "browser origin is not allowed").into_response();
    }
    let host = request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok());
    if !host.is_some_and(|host| {
        host == format!("127.0.0.1:{port}")
            || host == format!("localhost:{port}")
            || ALLOWED_ORIGINS
                .iter()
                .any(|origin| origin.strip_prefix("http://") == Some(host))
    }) {
        return error(StatusCode::FORBIDDEN, "request host is not allowed").into_response();
    }
    next.run(request).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Create {
    mode: Mode,
    seed: Option<u64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Credentials {
    session_id: String,
    player_id: String,
    token: String,
}
async fn create(
    State(store): State<Store>,
    Json(input): Json<Create>,
) -> Result<Json<Credentials>, Error> {
    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let mut s = Session::new(id.clone(), input.mode, input.seed.unwrap_or(42));
    let player_id = s
        .join(token.clone())
        .map_err(|e| error(StatusCode::BAD_REQUEST, &e))?;
    store.insert(s).await;
    Ok(Json(Credentials {
        session_id: id,
        player_id,
        token,
    }))
}
async fn join(
    State(store): State<Store>,
    Path(id): Path<String>,
) -> Result<Json<Credentials>, Error> {
    let token = Uuid::new_v4().to_string();
    let player_id = store
        .edit_session(&id, |session| {
            if session.mode != Mode::Online {
                return Err(error(
                    StatusCode::FORBIDDEN,
                    "training sessions are private",
                ));
            }
            session
                .join(token.clone())
                .map_err(|message| error(StatusCode::BAD_REQUEST, &message))
        })
        .await?;
    Ok(Json(Credentials {
        session_id: id,
        player_id,
        token,
    }))
}
async fn state(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<skyscraper_arena_server::Snapshot>, Error> {
    store
        .with_player(&id, &headers, |session, _| Ok(Json(session.snapshot())))
        .await
}
async fn command(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(command): Json<Command>,
) -> Result<Json<skyscraper_arena_server::Snapshot>, Error> {
    store
        .edit_player(&id, &headers, |session, owner| {
            session
                .command(owner, command)
                .map_err(|message| error(StatusCode::BAD_REQUEST, &message))?;
            Ok(Json(session.snapshot()))
        })
        .await
}
#[derive(Deserialize)]
struct WsAuth {
    token: String,
}
async fn ws(
    State(store): State<Store>,
    Path(id): Path<String>,
    Query(auth): Query<WsAuth>,
    upgrade: WebSocketUpgrade,
) -> Result<Response, Error> {
    store.with_token(&id, &auth.token, |_, _| Ok(())).await?;
    Ok(upgrade
        .on_upgrade(move |mut socket| async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            let mut shutdown = store.shutdown.subscribe();
            while !*shutdown.borrow() {
                tokio::select! {
                    _ = shutdown.changed() => {
                        let _ = socket.send(Message::Close(None)).await;
                        break;
                    },
                    _ = interval.tick() => {
                        let Ok(snapshot) = store
                            .with_session(&id, |session| Ok(session.snapshot()))
                            .await else { break };
                        let json = serde_json::to_string(&snapshot).unwrap();
                        if socket.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    },
                    message = socket.recv() => match message {
                        Some(Ok(Message::Ping(bytes))) => {
                            if socket.send(Message::Pong(bytes)).await.is_err() {
                                break;
                            }
                        },
                        Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                        _ => {}
                    }
                }
            }
        })
        .into_response())
}
#[tokio::main]
async fn main() {
    let directory = std::env::var_os("ARENA_DATA_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| "data".into());
    let store = Store::open(directory).expect("restore arena sessions");
    let port: u16 = std::env::var("ARENA_PORT")
        .unwrap_or_else(|_| "8787".into())
        .parse()
        .expect("ARENA_PORT must be a port number");
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .expect("bind local arena port");
    let address = listener.local_addr().unwrap();
    let clock = lifecycle::start_clock(store.clone());
    let app = Router::new()
        .route(
            "/health",
            get(|| async {
                Json(serde_json::json!({"ok":true,"protocol":"arena.v1","tickMillis":500}))
            }),
        )
        .route("/api/sessions", post(create))
        .route("/api/sessions/{id}/join", post(join))
        .route("/api/sessions/{id}/state", get(state))
        .route("/api/sessions/{id}/replay", get(replay_routes::export))
        .route(
            "/api/sessions/{id}/replay/timeline",
            get(replay_routes::timeline),
        )
        .route("/api/sessions/{id}/commands", post(command))
        .route(
            "/api/sessions/{id}/scripts/compile",
            post(script_routes::compile),
        )
        .route(
            "/api/sessions/{id}/scripts/preview",
            post(script_routes::preview),
        )
        .route("/ws/{id}", get(ws))
        .layer(
            CorsLayer::new()
                .allow_origin(ALLOWED_ORIGINS.map(HeaderValue::from_static))
                .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS]),
        )
        .layer(middleware::from_fn_with_state(address.port(), guard_origin))
        .with_state(store.clone());
    println!("Arena authority listening on http://{address}");
    axum::serve(listener, app)
        .with_graceful_shutdown(lifecycle::shutdown(store.clone(), clock))
        .await
        .unwrap();
    store
        .checkpoint()
        .await
        .expect("save arena sessions on shutdown");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_origins_are_exactly_allowlisted() {
        let mut headers = HeaderMap::new();
        assert!(origin_allowed(&headers));
        for origin in ALLOWED_ORIGINS {
            headers.insert(header::ORIGIN, HeaderValue::from_static(origin));
            assert!(origin_allowed(&headers));
        }
        for origin in [
            "null",
            "https://attacker.example",
            "http://localhost.attacker.example:5173",
            "http://127.0.0.1:9999",
        ] {
            headers.insert(header::ORIGIN, HeaderValue::from_static(origin));
            assert!(!origin_allowed(&headers));
        }
    }
}
