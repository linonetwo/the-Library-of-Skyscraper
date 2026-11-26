/** Canonical readonly projection of server tactics/view.rs (sim8, absent in older sessions). */
export type ScenarioId = 'first-expedition' | 'seal-contest';
export type SkillId = 'ink-strike';
export type WeaponState = 'unarmed' | 'staff';
export type CastPhase = 'chanting' | 'release' | 'recovery';
export type RecoveryPhase = 'downed' | 'rising';
export interface CastSnapshot {
  readonly skillId: SkillId; readonly targetId: string; readonly phase: CastPhase;
  readonly startedTick: number; readonly releaseTick: number; readonly endsTick: number;
}
export interface RecoverySnapshot {
  readonly phase: RecoveryPhase; readonly startedTick: number;
  readonly risingTick: number; readonly endsTick: number;
}
export interface TacticalActorSnapshot {
  readonly actorId: string; readonly weapon: WeaponState; readonly energy: number;
  readonly maxEnergy: number; readonly castReadyTick: number;
  readonly attackTargetId?: string; readonly cast?: CastSnapshot; readonly recovery?: RecoverySnapshot;
}
export interface ControlPointSnapshot {
  readonly roomId: string; readonly challengerId?: string;
  readonly progressTicks: number; readonly requiredTicks: number;
  readonly contested: boolean; readonly blockedReason?: string;
}
export interface TacticalSnapshot {
  readonly actorStates: readonly TacticalActorSnapshot[];
  readonly controlPoints: readonly ControlPointSnapshot[];
}
export type TacticalAction = 'attack' | 'repair' | 'claim' | 'cast' | 'recovery' | 'heavy';
export type TacticalPhase = 'applied' | 'rejected' | 'approaching' | 'started' | 'progress' | 'contested' | 'captured' | 'reset' | 'released' | 'interrupted' | 'completed' | 'downed' | 'rising' | 'telegraph';
export interface TacticalValues {
  readonly hpBefore?: number; readonly hpAfter?: number;
  readonly materialsBefore?: number; readonly materialsAfter?: number;
  readonly energyBefore?: number; readonly energyAfter?: number;
  readonly progressTicks?: number; readonly previousOwnerId?: string; readonly ownerId?: string;
}
export interface TacticalEvent {
  readonly action: TacticalAction; readonly actorId: string; readonly targetId: string;
  readonly targetPosition?: { readonly x: number; readonly y: number };
  readonly phase: TacticalPhase; readonly reasonCode?: string; readonly values: TacticalValues;
}
/** Resolved command DTO only; public callers cannot supply invocation proof. */
export type TacticalCommand =
  | { readonly type: 'attack'; readonly actorId: string; readonly targetId?: string }
  | { readonly type: 'repair'; readonly actorId: string; readonly buildingId: string }
  | { readonly type: 'claim'; readonly actorId: string; readonly roomId: string }
  | { readonly type: 'cast'; readonly actorId: string; readonly skillId: SkillId; readonly targetId: string };
export type EnemyRef = { type: 'enemy'; enemyId: string } | { type: 'enemyInRoom'; roomId: string; select: 'lowestHp' };
export type OwnBuildingRef = { type: 'ownBuilding'; buildingId: string } | { type: 'ownBuildingInRoom'; roomId: string; select: 'mostDamaged' };
export type ControlPointRef = { type: 'controlPoint'; roomId: string };
