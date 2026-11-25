import type { RuleSourceProject, CompileResult } from '../scriptTypes';
import type { RuleContext, RuleDecisionResult } from '../../../script-sdk/src/contract';
export interface RuleComparisonRequest {
  operationIndex: number;
  initialState: 'empty';
  a: RuleSourceProject;
  b: RuleSourceProject;
}
export interface ComparisonCandidate {
  sourceHash?: string | null;
  compilation?: CompileResult;
  execution?: { decision?: RuleDecisionResult; failure?: {kind: string; message: string}; durationMs: number };
  error?: string;
}
export interface RuleComparisonResult {
  kind: 'comparison'; sessionId: string; ownerId: string; operationIndex: number; tick: number;
  initialState: {mode: 'empty'; memory: Record<string, never>; tasks: 'recorded'};
  context: RuleContext;
  a: ComparisonCandidate;
  b: ComparisonCandidate;
}
