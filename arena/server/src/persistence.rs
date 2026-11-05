use serde::{Deserialize, Serialize};
use skyscraper_arena_server::{Replay, Session};
use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::PathBuf,
};

#[derive(Deserialize, Serialize)]
struct SavedSession {
    replay: Replay,
    tokens: BTreeMap<String, String>,
}

pub struct Persistence {
    directory: PathBuf,
}

impl Persistence {
    pub fn open(directory: PathBuf) -> io::Result<Self> {
        fs::create_dir_all(&directory)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))?;
        }
        Ok(Self { directory })
    }

    pub fn restore(&self) -> io::Result<BTreeMap<String, Session>> {
        let mut sessions = BTreeMap::new();
        for entry in fs::read_dir(&self.directory)? {
            let path = entry?.path();
            if path.extension().is_none_or(|extension| extension != "json") {
                continue;
            }
            let restore = || -> io::Result<Session> {
                let saved: SavedSession = serde_json::from_slice(&fs::read(&path)?)?;
                let mut session = Session::from_replay(&saved.replay).map_err(io::Error::other)?;
                session.tokens = saved.tokens;
                Ok(session)
            };
            let session = restore()
                .map_err(|error| io::Error::other(format!("{}: {error}", path.display())))?;
            sessions.insert(session.id.clone(), session);
        }
        Ok(sessions)
    }

    pub fn save(&self, session: &mut Session) -> io::Result<()> {
        let saved = SavedSession {
            replay: session.export_replay().map_err(io::Error::other)?,
            tokens: session.tokens.clone(),
        };
        let bytes = serde_json::to_vec(&saved)?;
        let path = self.directory.join(format!("{}.json", session.id));
        let pending = path.with_extension("pending");
        let mut options = OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&pending)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        fs::rename(pending, path)?;
        Ok(())
    }
}
