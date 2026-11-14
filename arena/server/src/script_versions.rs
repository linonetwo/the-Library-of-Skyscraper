use crate::{PublishedScript, ScriptMetadata, Session};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptVersionMetadata {
    pub source_hash: String,
    pub entry: String,
    pub created_at_tick: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_source_hash: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct StoredScriptVersion {
    pub metadata: ScriptVersionMetadata,
    pub script: PublishedScript,
    sequence: u64,
}

pub type RuleVersionCatalog = BTreeMap<String, BTreeMap<String, StoredScriptVersion>>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptVersionList {
    pub active_source_hash: Option<String>,
    pub versions: Vec<ScriptVersionMetadata>,
}

impl Session {
    pub fn script_versions(&self, owner: &str) -> ScriptVersionList {
        let mut versions: Vec<_> = self
            .script_versions
            .get(owner)
            .into_iter()
            .flat_map(|catalog| catalog.values())
            .collect();
        versions.sort_by_key(|version| std::cmp::Reverse(version.sequence));
        ScriptVersionList {
            active_source_hash: self.players[owner]
                .script
                .as_ref()
                .map(|script| script.source_hash.clone()),
            versions: versions
                .into_iter()
                .map(|version| version.metadata.clone())
                .collect(),
        }
    }

    pub fn script_version(&self, owner: &str, hash: &str) -> Option<&StoredScriptVersion> {
        self.script_versions
            .get(owner)
            .and_then(|catalog| catalog.get(hash))
    }

    pub(crate) fn archive_script(
        &mut self,
        owner: &str,
        script: PublishedScript,
        created_at_tick: u64,
    ) -> String {
        let hash = script.bundle["sourceHash"].as_str().unwrap().to_owned();
        let parent_source_hash = self.players[owner]
            .script
            .as_ref()
            .map(|active| active.source_hash.clone());
        let versions = self.script_versions.entry(owner.into()).or_default();
        let sequence = versions
            .values()
            .map(|version| version.sequence)
            .max()
            .unwrap_or(0)
            + 1;
        versions
            .entry(hash.clone())
            .or_insert_with(|| StoredScriptVersion {
                metadata: ScriptVersionMetadata {
                    source_hash: hash.clone(),
                    entry: script.bundle["entry"].as_str().unwrap().into(),
                    created_at_tick,
                    parent_source_hash: parent_source_hash.filter(|parent| parent != &hash),
                },
                script,
                sequence,
            });
        hash
    }

    pub fn rollback_script(&mut self, owner: &str, hash: &str) -> Result<(), String> {
        let version = self
            .script_version(owner, hash)
            .cloned()
            .ok_or("script version not found")?;
        self.scripts.insert(owner.into(), version.script);
        self.set_script_metadata(
            owner,
            Some(ScriptMetadata {
                source_hash: version.metadata.source_hash,
                entry: version.metadata.entry,
                published_at_tick: self.tick,
            }),
        );
        Ok(())
    }

    pub(crate) fn migrate_script_versions(&mut self) {
        for (owner, script) in self.scripts.clone() {
            let created_at_tick = self.players[&owner]
                .script
                .as_ref()
                .map_or(self.tick, |metadata| metadata.published_at_tick);
            self.archive_script(&owner, script, created_at_tick);
        }
    }
}
