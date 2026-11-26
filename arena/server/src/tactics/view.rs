use super::SkillId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WeaponState {
    Unarmed,
    Staff,
}
impl From<crate::Appearance> for WeaponState {
    fn from(value: crate::Appearance) -> Self {
        if value.weapon {
            Self::Staff
        } else {
            Self::Unarmed
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CastPhase {
    Chanting,
    Release,
    Recovery,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecoveryPhase {
    Downed,
    Rising,
}

/// Read-only projection at the current authoritative tick. No private source.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticalSnapshot {
    pub actor_states: Vec<TacticalActorSnapshot>,
    pub control_points: Vec<ControlPointSnapshot>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticalActorSnapshot {
    pub actor_id: String,
    pub weapon: WeaponState,
    pub energy: u32,
    pub max_energy: u32,
    pub cast_ready_tick: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attack_target_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cast: Option<CastSnapshot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery: Option<RecoverySnapshot>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CastSnapshot {
    pub skill_id: SkillId,
    pub target_id: String,
    pub phase: CastPhase,
    pub started_tick: u64,
    pub release_tick: u64,
    pub ends_tick: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySnapshot {
    pub phase: RecoveryPhase,
    pub started_tick: u64,
    pub rising_tick: u64,
    pub ends_tick: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlPointSnapshot {
    pub room_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challenger_id: Option<String>,
    pub progress_ticks: u32,
    pub required_ticks: u32,
    pub contested: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocked_reason: Option<String>,
}

/// Added to the existing Event, so the original operation still owns the result.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticalEvent {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_position: Option<crate::Position>,
    pub action: TacticalAction,
    pub actor_id: String,
    pub target_id: String,
    pub phase: TacticalPhase,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<String>,
    pub values: TacticalValues,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TacticalAction {
    Attack,
    Repair,
    Claim,
    Cast,
    Recovery,
    Heavy,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TacticalPhase {
    Applied,
    Rejected,
    Approaching,
    Started,
    Progress,
    Contested,
    Captured,
    Reset,
    Released,
    Interrupted,
    Completed,
    Downed,
    Rising,
    Telegraph,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticalValues {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hp_before: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hp_after: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub materials_before: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub materials_after: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub energy_before: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub energy_after: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress_ticks: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_owner_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<String>,
}
