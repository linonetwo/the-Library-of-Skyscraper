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
export interface RuleRuntimeState {
  operationIndex?: number | null;
  sourceHash: string | null;
  memory: import("../../script-sdk/src/views").RuleMemory;
  tasks: import("../../script-sdk/src/views").TaskQueueView;
}
export interface ScriptPreview {
  tick: number;
  sourceHash?: string;
  compilation: import("../../script-toolchain/src/compile").CompileResult;
  execution?: {
    decision?: import("../../script-sdk/src/contract").RuleDecisionResult;
    failure?: { kind: string; message: string };
    durationMs: number;
  };
}
