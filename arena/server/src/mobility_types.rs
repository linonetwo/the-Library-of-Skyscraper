//! Sim7 movement wire: integer millimeters and one segment-local time cursor.
use crate::Position;
use serde::{Deserialize, Serialize};
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
pub struct Point3Milli {
    pub x: i64,
    pub y: i64,
    pub z: i64,
}
impl Point3Milli {
    pub fn ground(p: Position) -> Self {
        Self {
            x: (p.x * 1000.).round() as i64,
            y: (p.y * 1000.).round() as i64,
            z: 0,
        }
    }
    pub fn xy(self) -> Position {
        Position {
            x: self.x as f64 / 1000.,
            y: self.y as f64 / 1000.,
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TravelKind {
    Walk,
    Run,
    Jump,
    Climb,
}
impl TravelKind {
    pub fn speed(self) -> u64 {
        match self {
            Self::Run => 1500,
            Self::Climb => 500,
            _ => 750,
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SegmentRole {
    Ground,
    Gap,
    Ladder,
    Transfer,
    Traverse,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LocomotionPhase {
    Walk,
    Run,
    Takeoff,
    Airborne,
    Landing,
    Grip,
    Descend,
    Crest,
    Traverse,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TravelSegment {
    pub kind: TravelKind,
    pub role: SegmentRole,
    pub from: Point3Milli,
    pub to: Point3Milli,
    pub length_milli: u64,
    pub duration_micros: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ladder_facing: Option<Position>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arc_height_milli: Option<u64>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Locomotion {
    pub kind: TravelKind,
    pub phase: LocomotionPhase,
    pub progress: f64,
}
