import type {
  AuthorizedWorldView, EntityId, PlayerScriptView, RuleMemory,
  SquadScriptView, TaskQueueView, TaskDraft,
} from './views.ts';

export interface RuleExecutionLimits {
  readonly maxIntents: number;
  readonly maxTaskPatches: number;
  readonly maxLogEntries: number;
  readonly maxMemoryBytes: number;
  readonly remainingBudgetTokens: number;
}

export interface RuleContext {
  readonly tick: number;
  readonly player: PlayerScriptView;
  readonly squad: SquadScriptView;
  readonly world: AuthorizedWorldView;
  readonly tasks: TaskQueueView;
  readonly memory: RuleMemory;
  readonly limits: RuleExecutionLimits;
}

export interface BaseIntentDraft {
  readonly actorId: EntityId;
  readonly priority: number;
  readonly reason?: string;
}

export interface MoveIntentDraft extends BaseIntentDraft {
  readonly type: 'move';
  readonly roomId: EntityId;
}

export interface RunIntentDraft extends BaseIntentDraft { readonly type: 'run'; readonly viaRoomId: EntityId; readonly roomId: EntityId }
export interface JumpIntentDraft extends BaseIntentDraft { readonly type: 'jump'; readonly edgeId: string }
export interface ClimbIntentDraft extends BaseIntentDraft { readonly type: 'climb'; readonly edgeId: string }

export interface GatherIntentDraft extends BaseIntentDraft { readonly type: 'gather' }
export interface DeliverIntentDraft extends BaseIntentDraft { readonly type: 'deliver' }
export interface AttackIntentDraft extends BaseIntentDraft { readonly type: 'attack' }
export interface CaptureIntentDraft extends BaseIntentDraft { readonly type: 'capture' }

export interface BuildIntentDraft extends BaseIntentDraft {
  readonly type: 'build';
  readonly roomId: EntityId;
  readonly kind: 'tower' | 'catalog';
}

/** v0 names follow today's authority commands: deliver/capture, not transfer/claim. */
export type ActionIntentDraft =
  | MoveIntentDraft | RunIntentDraft | JumpIntentDraft | ClimbIntentDraft | GatherIntentDraft | DeliverIntentDraft
  | AttackIntentDraft | CaptureIntentDraft | BuildIntentDraft;

export interface RuleMemoryPatch {
  readonly set?: RuleMemory;
  readonly remove?: readonly string[];
}

export type TaskPatchDraft =
  | { readonly type: 'upsert'; readonly task: TaskDraft }
  | { readonly type: 'remove'; readonly taskId: string };

export interface RuleDecisionResult {
  readonly intents: readonly ActionIntentDraft[];
  readonly memoryPatch?: RuleMemoryPatch;
  readonly taskPatches?: readonly TaskPatchDraft[];
}

export interface ActionRuleModule {
  decide(ctx: RuleContext): RuleDecisionResult;
}
