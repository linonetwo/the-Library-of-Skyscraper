use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ScenarioId {
    #[default]
    FirstExpedition,
    SealContest,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SkillId {
    InkStrike,
}

/// Private authority state, saved once in the checkpoint. Public views exclude
/// source hashes and the worker's future invocation records.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticalState {
    pub actor_states: BTreeMap<String, TacticalActorState>,
    pub control_points: BTreeMap<String, ControlPointState>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticalActorState {
    pub energy: u32,
    pub last_energy_tick: u64,
    pub cast_ready_tick: u64,
    pub last_repair_tick: Option<u64>,
    pub attack_target_id: Option<String>,
    pub cast: Option<CastState>,
    pub recovery: Option<RecoveryState>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CastState {
    pub skill_id: SkillId,
    pub target_id: String,
    pub started_tick: u64,
    pub release_tick: u64,
    /// Exclusive end: N+2 and N+3 are recovery; N+4 is actionable.
    pub ends_tick: u64,
    pub source_hash: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryState {
    pub started_tick: u64,
    pub rising_tick: u64,
    pub ends_tick: u64,
}

/// Owner remains Room.owner, score remains Player.score. Neither is duplicated.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlPointState {
    #[serde(default)]
    pub last_actor_id: Option<String>,
    pub challenger_id: Option<String>,
    pub progress_ticks: u32,
}

impl Default for TacticalActorState {
    fn default() -> Self {
        Self {
            energy: 3,
            last_energy_tick: 0,
            cast_ready_tick: 0,
            last_repair_tick: None,
            attack_target_id: None,
            cast: None,
            recovery: None,
        }
    }
}
