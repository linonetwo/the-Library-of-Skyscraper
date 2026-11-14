export type { CompileResult, RuleDiagnostic, RuleSourceProject } from "../../script-toolchain/src/compile";
export interface RuleVersion {
  sourceHash: string;
  entry: string;
  createdAtTick: number;
  parentSourceHash?: string;
}
export interface RuleVersionList {
  activeSourceHash: string | null;
  versions: RuleVersion[];
}
export interface RuleVersionSource {
  version: RuleVersion;
  project: import("../../script-toolchain/src/compile").RuleSourceProject;
}
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
