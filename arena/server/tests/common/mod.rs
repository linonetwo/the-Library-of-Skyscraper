use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    net::{SocketAddr, TcpStream},
    path::Path,
    process::{Child, Command, Stdio},
    time::Duration,
};

pub struct Server {
    child: Child,
    address: SocketAddr,
}

impl Server {
    pub fn start(directory: &Path) -> Self {
        let mut server = Self {
            child: Command::new(env!("CARGO_BIN_EXE_skyscraper-arena-server"))
                .env("ARENA_DATA_DIR", directory)
                .env("ARENA_PORT", "0")
                .stdout(Stdio::piped())
                .spawn()
                .unwrap(),
            address: SocketAddr::from(([127, 0, 0, 1], 0)),
        };
        let mut output = BufReader::new(server.child.stdout.take().unwrap());
        loop {
            let mut line = String::new();
            assert!(
                output.read_line(&mut line).unwrap() > 0,
                "server startup ended"
            );
            if let Some(address) = line
                .trim()
                .strip_prefix("Arena authority listening on http://")
            {
                server.address = address.parse().unwrap();
                return server;
            }
        }
    }

    pub fn request(&self, method: &str, path: &str, token: &str, body: Value) -> (u16, Value) {
        let body = body.to_string();
        let mut stream = TcpStream::connect(self.address).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        write!(stream,
            "{method} {path} HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            self.address, body.len()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        let (headers, body) = response.split_once("\r\n\r\n").unwrap();
        let status = headers.split_whitespace().nth(1).unwrap().parse().unwrap();
        (status, serde_json::from_str(body).unwrap())
    }

    pub fn stop(mut self) {
        assert!(
            Command::new("kill")
                .arg("-TERM")
                .arg(self.child.id().to_string())
                .status()
                .unwrap()
                .success()
        );
        assert!(self.child.wait().unwrap().success());
    }

    pub fn crash(mut self) {
        self.child.kill().unwrap();
        self.child.wait().unwrap();
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        if self.child.try_wait().unwrap().is_none() {
            self.child.kill().unwrap();
            self.child.wait().unwrap();
        }
    }
}
