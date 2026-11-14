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
use std::{collections::BTreeMap, sync::Arc, time::Duration};
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

type Store = Arc<Mutex<BTreeMap<String, Session>>>;
type Error = (StatusCode, Json<serde_json::Value>);
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
async fn guard_origin(request: Request, next: Next) -> Response {
    if !origin_allowed(request.headers()) {
        return error(StatusCode::FORBIDDEN, "browser origin is not allowed").into_response();
    }
    let host = request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok());
    if !host.is_some_and(|host| {
        ALLOWED_ORIGINS
            .iter()
            .any(|origin| origin.strip_prefix("http://") == Some(host))
    }) {
        return error(StatusCode::FORBIDDEN, "request host is not allowed").into_response();
    }
    next.run(request).await
}
fn error(status: StatusCode, message: &str) -> Error {
    (status, Json(serde_json::json!({"error":message})))
}
fn authorize(s: &Session, headers: &HeaderMap) -> Result<String, Error> {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");
    s.tokens.get(token).cloned().ok_or_else(|| {
        error(
            StatusCode::UNAUTHORIZED,
            "valid session bearer token required",
        )
    })
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
    let mut store = store.lock().await;
    if store.len() >= 128 {
        return Err(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "local session capacity reached; restart server to clear sessions",
        ));
    }
    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let mut s = Session::new(id.clone(), input.mode, input.seed.unwrap_or(42));
    let player_id = s
        .join(token.clone())
        .map_err(|e| error(StatusCode::BAD_REQUEST, &e))?;
    store.insert(id.clone(), s);
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
    let mut store = store.lock().await;
    let s = store
        .get_mut(&id)
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))?;
    if s.mode != Mode::Online {
        return Err(error(
            StatusCode::FORBIDDEN,
            "training sessions are private",
        ));
    }
    let token = Uuid::new_v4().to_string();
    let player_id = s
        .join(token.clone())
        .map_err(|e| error(StatusCode::BAD_REQUEST, &e))?;
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
    let mut store = store.lock().await;
    let s = store
        .get_mut(&id)
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))?;
    authorize(s, &headers)?;
    Ok(Json(s.snapshot()))
}
async fn command(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(command): Json<Command>,
) -> Result<Json<skyscraper_arena_server::Snapshot>, Error> {
    let mut store = store.lock().await;
    let s = store
        .get_mut(&id)
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))?;
    let owner = authorize(s, &headers)?;
    s.command(&owner, command)
        .map_err(|e| error(StatusCode::BAD_REQUEST, &e))?;
    Ok(Json(s.snapshot()))
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
    {
        let store = store.lock().await;
        let s = store
            .get(&id)
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))?;
        if !s.tokens.contains_key(&auth.token) {
            return Err(error(StatusCode::UNAUTHORIZED, "invalid token"));
        }
    }
    Ok(upgrade.on_upgrade(move|mut socket|async move{
        let mut interval=tokio::time::interval(Duration::from_millis(500));
        loop {
            tokio::select! {
                _=interval.tick()=>{
                    let json={let mut store=store.lock().await;let Some(s)=store.get_mut(&id)else{break};serde_json::to_string(&s.snapshot()).unwrap()};
                    if socket.send(Message::Text(json.into())).await.is_err(){break}
                },
                message=socket.recv()=>{match message{Some(Ok(Message::Ping(bytes)))=>{if socket.send(Message::Pong(bytes)).await.is_err(){break}},Some(Ok(Message::Close(_)))|None|Some(Err(_))=>break,_=>{}}}
            }
        }
    }).into_response())
}
#[tokio::main]
async fn main() {
    let store: Store = Arc::new(Mutex::new(BTreeMap::new()));
    let clock = store.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(500));
        loop {
            interval.tick().await;
            let mut sessions = clock.lock().await;
            for s in sessions.values_mut() {
                if !s.paused {
                    s.advance()
                }
            }
        }
    });
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
        .route("/api/sessions/{id}/commands", post(command))
        .route("/ws/{id}", get(ws))
        .layer(
            CorsLayer::new()
                .allow_origin(ALLOWED_ORIGINS.map(HeaderValue::from_static))
                .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS]),
        )
        .layer(middleware::from_fn(guard_origin))
        .with_state(store);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8787")
        .await
        .expect("bind 127.0.0.1:8787");
    println!("Arena authority listening on http://127.0.0.1:8787");
    axum::serve(listener, app).await.unwrap();
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
