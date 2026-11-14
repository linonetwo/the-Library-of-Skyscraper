use super::*;
use serde_json::json;

fn echo_runner() -> io::Result<Command> {
    let mut command = Command::new("sh");
    command.arg("-c").arg(
        r#"while IFS= read -r line; do printf '{"pid":%s,"request":%s}\n' "$$" "$line"; done"#,
    );
    Ok(command)
}

#[tokio::test]
async fn two_processes_are_reused_across_clones() {
    let pool = ScriptWorkers::with_launcher(echo_runner);
    let clone = pool.clone();
    let a = pool.execute(&json!({"tick": 1})).await.unwrap();
    let b = clone.execute(&json!({"tick": 2})).await.unwrap();
    let c = pool.execute(&json!({"tick": 3})).await.unwrap();
    assert_ne!(a["pid"], b["pid"]);
    assert_eq!(a["pid"], c["pid"]);
    assert_eq!(c["request"]["tick"], 3);
}

#[tokio::test]
async fn concurrent_requests_keep_their_own_response() {
    let pool = ScriptWorkers::with_launcher(echo_runner);
    let mut tasks = tokio::task::JoinSet::new();
    for tick in 0..12 {
        let pool = pool.clone();
        tasks.spawn(async move {
            let output = pool.execute(&json!({"tick": tick})).await.unwrap();
            assert_eq!(output["request"]["tick"], tick);
        });
    }
    while let Some(task) = tasks.join_next().await {
        task.unwrap();
    }
}

#[tokio::test]
async fn failed_worker_is_replaced_on_a_later_request() {
    fn exits_on_request() -> io::Result<Command> {
        let mut command = Command::new("sh");
        command.arg("-c").arg(
            r#"while IFS= read -r line; do case "$line" in *crash*) exit 1;; esac; printf '{"pid":%s}\n' "$$"; done"#,
        );
        Ok(command)
    }
    let pool = ScriptWorkers::with_launcher(exits_on_request);
    let a = pool.execute(&json!({})).await.unwrap();
    pool.execute(&json!({})).await.unwrap();
    assert!(pool.execute(&json!({"crash": true})).await.is_err());
    pool.execute(&json!({})).await.unwrap();
    let restarted = pool.execute(&json!({})).await.unwrap();
    assert_ne!(a["pid"], restarted["pid"]);
}

#[tokio::test]
async fn cancelled_request_drops_its_pending_response() {
    fn delayed_runner() -> io::Result<Command> {
        let mut command = Command::new("sh");
        command.arg("-c").arg(
            r#"while IFS= read -r line; do case "$line" in *slow*) sleep 0.2;; esac; printf '{"pid":%s,"request":%s}\n' "$$" "$line"; done"#,
        );
        Ok(command)
    }
    let pool = ScriptWorkers::with_launcher(delayed_runner);
    let first = pool.execute(&json!({})).await.unwrap();
    pool.execute(&json!({})).await.unwrap();
    let cancelled = tokio::time::timeout(
        std::time::Duration::from_millis(20),
        pool.execute(&json!({"slow": true})),
    )
    .await;
    assert!(cancelled.is_err());
    pool.execute(&json!({})).await.unwrap();
    let next = pool.execute(&json!({"tick": 5})).await.unwrap();
    assert_ne!(next["pid"], first["pid"]);
    assert_eq!(next["request"]["tick"], 5);
}

#[tokio::test]
#[ignore = "requires built V8 runner at ARENA_SCRIPT_RUNNER"]
async fn real_v8_worker_survives_rule_timeout() {
    let pool = ScriptWorkers::default();
    let request = |code| {
        json!({
            "bundle": {"sourceHash": "pool-test", "code": code},
            "context": {"tick": 1},
        })
    };
    let good = request("var __arenaRule = {decide: () => ({intents: []})};");
    let endless = request("var __arenaRule = {decide: () => {while(true){}}};");
    let first = pool.execute(&good).await.unwrap();
    pool.execute(&good).await.unwrap();
    let timeout = pool.execute(&endless).await.unwrap();
    pool.execute(&good).await.unwrap();
    let recovered = pool.execute(&good).await.unwrap();
    assert_eq!(first["decision"]["intents"], json!([]));
    assert_eq!(timeout["failure"]["kind"], "timeout");
    assert_eq!(recovered["decision"]["intents"], json!([]));
}
