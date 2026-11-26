//! sim8 tactical wire contracts. Runtime integration follows the domain slices.
mod state;
mod view;
pub use state::*;
pub use view::*;

pub const TACTICAL_SIMULATION_VERSION: u32 = 8;
mod attack;
mod claim;
mod command;
pub(crate) mod point_presence;
mod repair;
mod scenario;
mod settlement;
mod snapshot;

mod chant;
pub use chant::{ChantOp, ChantRecord, ChantResult, ChantStep, ChantVerdict, RecordedChant};
mod cast;
mod cast_tick;
mod damage;
mod heavy;
mod recovery;
mod source;
