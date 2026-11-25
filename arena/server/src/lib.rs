mod action_runtime;
mod actions;
mod appearance;
mod checkpoint;
mod commands;
mod economy;
pub mod script_state;
mod script_tasks;
mod script_types;
mod script_versions;
mod scripting;
mod session;
mod simulation;
mod types;

pub mod replay;
mod replay_rule_history;
pub use appearance::{Appearance, Hair, Outfit};
pub use checkpoint::SessionCheckpoint;
pub use replay::{Replay, ReplayOperation};
pub use script_types::*;
pub use script_versions::{
    RuleVersionCatalog, ScriptVersionList, ScriptVersionMetadata, StoredScriptVersion,
};
pub use session::Session;
pub use types::*;

#[cfg(test)]
mod appearance_tests;
#[cfg(test)]
mod checkpoint_tests;
#[cfg(test)]
mod economy_tests;
#[cfg(test)]
mod script_versions_tests;
#[cfg(test)]
mod scripting_tests;
#[cfg(test)]
mod tests;

mod combat;
mod construction;
mod legacy_commands;
mod legacy_simulation;
#[cfg(test)]
mod playable_tests;
mod scenario;
mod tasks;
mod travel;

#[cfg(test)]
mod action_runtime_tests;

#[cfg(test)]
mod combat_spacing_tests;

mod combat_approach;

#[cfg(test)]
mod script_retreat_tests;

mod mobility_types;
pub use mobility_types::{
    Locomotion, LocomotionPhase, Point3Milli, SegmentRole, TravelKind, TravelSegment,
};
mod mobility;
#[cfg(test)]
mod mobility_persistence_tests;
#[cfg(test)]
mod mobility_tests;
mod travel_map;
mod travel_segments;
