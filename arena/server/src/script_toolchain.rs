use crate::store::{Error, error};
use axum::http::StatusCode;
use serde_json::Value;
use skyscraper_arena_server::SourceProject;
use std::{path::PathBuf, process::Stdio};
use tokio::{io::AsyncWriteExt, process::Command};

pub async fn compile_project(project: &SourceProject) -> Result<Value, Error> {
    let cli = std::env::var_os("ARENA_SCRIPT_TOOLCHAIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../script-toolchain/cli.mjs")
        });
    let mut child = Command::new("node")
        .arg(cli)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(service_error)?;
    let mut stdin = child.stdin.take().unwrap();
    let mut bytes = serde_json::to_vec(project).unwrap();
    bytes.push(b'\n');
    stdin.write_all(&bytes).await.map_err(service_error)?;
    drop(stdin);
    let output = child.wait_with_output().await.map_err(service_error)?;
    if !output.status.success() {
        return Err(service_error(String::from_utf8_lossy(&output.stderr)));
    }
    serde_json::from_slice(&output.stdout).map_err(service_error)
}

pub fn service_error(message: impl std::fmt::Display) -> Error {
    error(
        StatusCode::BAD_GATEWAY,
        &format!("script service: {message}"),
    )
}
