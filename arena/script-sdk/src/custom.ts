import type { ActionIntentDraft, RuleContext } from './contract.ts';
import type { ActorScriptView, MemoryValue } from './views.ts';
type WithoutActor<T> = T extends unknown ? Omit<T, 'actorId' | 'priority' | 'reason'> : never;
/** The graph supplies the current actor and instance priority at the call site. */
export type CustomAction = WithoutActor<ActionIntentDraft>;
export interface CustomModuleInput<P> extends Pick<RuleContext, 'tick' | 'player' | 'squad' | 'world' | 'tasks'> {
  readonly actor: ActorScriptView;
  readonly params: Readonly<P>;
  readonly memory: MemoryValue;
}
export type CustomModuleResult<E extends string> = (
  | { type: 'action'; intent: CustomAction; reason: string }
  | { type: 'hold'; reason: string }
  | { type: 'exit'; key: E; reason: string }
) & { memory?: MemoryValue };
