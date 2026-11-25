/** Authority-owned sim7 wire. Positions in this module use integer millimeters. */
export type Point3Milli = { x: number; y: number; z: number };
export type TravelKind = 'walk' | 'run' | 'jump' | 'climb';
export type SegmentRole = 'ground' | 'gap' | 'ladder' | 'transfer' | 'traverse';
export type LocomotionPhase = 'walk' | 'run' | 'takeoff' | 'airborne' | 'landing' | 'grip' | 'descend' | 'crest' | 'traverse';
export interface TravelSegment {
  kind: TravelKind;
  role: SegmentRole;
  from: Point3Milli;
  to: Point3Milli;
  lengthMilli: number;
  durationMicros: number;
  edgeId?: string;
  ladderFacing?: { x: number; y: number };
  arcHeightMilli?: number;
}
export interface Locomotion {
  kind: TravelKind;
  phase: LocomotionPhase;
  /** Normalized current segment time, sampled by the authority. */
  progress: number;
}
export interface MobilityEdge {
  edgeId: string;
  kind: 'jump' | 'climb';
  fromRoomId: string;
  toRoomId: string;
  segments: TravelSegment[];
  landingRadiusMilli: number;
  supports?: { from: Point3Milli; to: Point3Milli; widthMilli: number }[];
}
