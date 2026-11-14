use serde_json::Value;
use std::{
    io,
    path::PathBuf,
    process::Stdio,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::Mutex,
};

#[derive(Clone)]
pub struct ScriptWorkers(Arc<Pool>);

struct Pool {
    slots: [Mutex<Option<Worker>>; 2],
    next: AtomicUsize,
    launch: fn() -> io::Result<Command>,
}

struct Worker {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl Default for ScriptWorkers {
    fn default() -> Self {
        Self::with_launcher(runner_command)
    }
}

impl ScriptWorkers {
    fn with_launcher(launch: fn() -> io::Result<Command>) -> Self {
        Self(Arc::new(Pool {
            slots: Default::default(),
            next: AtomicUsize::new(0),
            launch,
        }))
    }

    pub async fn execute(&self, request: &Value) -> Result<Value, String> {
        let index = self.0.next.fetch_add(1, Ordering::Relaxed) % self.0.slots.len();
        let mut slot = self.0.slots[index].lock().await;
        // Ownership leaves the slot during exchange: cancellation also drops
        // the child, so its pending response cannot become another tick's result.
        let mut worker = match slot.take() {
            Some(worker) => worker,
            None => Worker::spawn((self.0.launch)().map_err(message)?)?,
        };
        if worker.child.try_wait().map_err(message)?.is_some() {
            worker = Worker::spawn((self.0.launch)().map_err(message)?)?;
        }
        let response = worker.exchange(request).await?;
        *slot = Some(worker);
        Ok(response)
    }
}

impl Worker {
    fn spawn(mut command: Command) -> Result<Self, String> {
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(message)?;
        Ok(Self {
            input: child.stdin.take().expect("piped runner stdin"),
            output: BufReader::new(child.stdout.take().expect("piped runner stdout")),
            child,
        })
    }

    async fn exchange(&mut self, request: &Value) -> Result<Value, String> {
        let mut bytes = serde_json::to_vec(request).map_err(message)?;
        bytes.push(b'\n');
        self.input.write_all(&bytes).await.map_err(message)?;
        self.input.flush().await.map_err(message)?;
        let mut line = String::new();
        if self.output.read_line(&mut line).await.map_err(message)? == 0 {
            return Err("script runner closed its response stream".into());
        }
        serde_json::from_str(&line).map_err(message)
    }
}

fn runner_command() -> io::Result<Command> {
    let path = std::env::var_os("ARENA_SCRIPT_RUNNER")
        .map(PathBuf::from)
        .map(Ok)
        .unwrap_or_else(|| {
            std::env::current_exe()
                .map(|path| path.with_file_name("skyscraper-arena-script-runner"))
        })?;
    Ok(Command::new(path))
}

fn message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(all(test, unix))]
mod tests;
