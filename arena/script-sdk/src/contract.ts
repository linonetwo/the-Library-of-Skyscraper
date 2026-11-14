import type {
  AuthorizedWorldView, EntityId, PlayerScriptView, RuleMemory,
  SquadScriptView, TaskQueueView,
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
  | MoveIntentDraft | GatherIntentDraft | DeliverIntentDraft
  | AttackIntentDraft | CaptureIntentDraft | BuildIntentDraft;

export interface RuleDecisionResult {
  readonly intents: readonly ActionIntentDraft[];
}

export interface ActionRuleModule {
  decide(ctx: RuleContext): RuleDecisionResult;
}
