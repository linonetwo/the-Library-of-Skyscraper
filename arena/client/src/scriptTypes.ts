export type { CompileResult, RuleDiagnostic, RuleSourceProject } from "../../script-toolchain/src/compile";
export interface ScriptPublication {
  compilation: import("../../script-toolchain/src/compile").CompileResult;
  snapshot?: import("./types").Snapshot;
}
export interface ScriptPreview {
  tick: number;
  compilation: import("../../script-toolchain/src/compile").CompileResult;
  execution?: {
    decision?: { intents: { type: string; actorId: string; roomId?: string; reason?: string }[] };
    failure?: { kind: string; message: string };
    durationMs: number;
  };
}
