//! sim8 tactical wire contracts. Runtime integration follows the domain slices.
mod state;
mod view;
pub use state::*;
pub use view::*;

pub const TACTICAL_SIMULATION_VERSION: u32 = 8;
