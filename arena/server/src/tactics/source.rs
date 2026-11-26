use crate::{ArchivedSkillSource, Session, SourceProject};
use std::collections::BTreeMap;
impl Session {
    /// Official skill source is an immutable read-only archive, not a rule version.
    pub fn archive_official_chant(&mut self, owner: &str, hash: &str, source: &str) {
        let Some(tactics) = self.tactics.as_mut() else {
            return;
        };
        tactics
            .skill_sources
            .entry(owner.into())
            .or_default()
            .entry(hash.into())
            .or_insert_with(|| ArchivedSkillSource {
                project: SourceProject {
                    files: BTreeMap::from([("ink-strike.js".into(), source.into())]),
                    entry: Some("ink-strike.js".into()),
                },
                created_at_tick: self.tick,
            });
    }
    pub fn archived_skill_source(&self, owner: &str, hash: &str) -> Option<&ArchivedSkillSource> {
        self.tactics.as_ref()?.skill_sources.get(owner)?.get(hash)
    }
}
