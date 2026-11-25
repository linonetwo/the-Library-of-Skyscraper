import { recoverRuleGraph, toGraphSourceProject } from "../../behavior-modules/graph";
import { useRef, useState } from "react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import type {
  CompileResult,
  ScriptPreview,
  RuleSourceProject,
  RuleDiagnostic,
} from "./scriptTypes";
import { draftKey, projectDraft, readDraft, type RuleDraft } from "./ruleDraft";

export function useScriptWorkbench() {
  const { session, ready, acceptSnapshot } = useArena();
  const [draft, setDraft] = useState(() => readDraft(session));
  const [location, setLocation] = useState<{
    file: string;
    line: number;
    column: number;
    nonce: number;
  }>();
  const [compilation, setCompilation] = useState<CompileResult | null>(null);
  const [preview, setPreview] = useState<ScriptPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const save = (next: RuleDraft) => {
    setDraft(next);
    localStorage.setItem(draftKey(session), JSON.stringify(next));
  };
  const update = (next: RuleDraft) => {
    revision.current++;
    save(next);
    setCompilation(null);
    setPreview(null);
  };
  const edit = (value: string) =>
    update({
      ...draft,
      graphHistory: undefined,
      files: { ...draft.files, [draft.activeFile]: value },
    });
  const editProject = (
    project: RuleSourceProject,
    graphHistory?: RuleDraft["graphHistory"],
  ) =>
    update({
      ...draft,
      files: project.files,
      entry: project.entry ?? "main.ts",
      activeFile:
        draft.activeFile in project.files
          ? draft.activeFile
          : (project.entry ?? "main.ts"),
      graphHistory,
    });
  const restoreDraft = (next: RuleDraft) => update(next);
  const selectFile = (activeFile: string) => save({ ...draft, activeFile });
  const addFile = (name: string) =>
    update({
      ...draft,
      activeFile: name,
      files: { ...draft.files, [name]: draft.files[name] ?? "" },
    });
  const setEntry = (entry: string) => update({ ...draft, entry });
  const loadProject = (project: RuleSourceProject, baseVersion?: string) =>
    update(projectDraft(project, baseVersion));
  const jump = (diagnostic: RuleDiagnostic) => {
    if (diagnostic.file in draft.files) {
      selectFile(diagnostic.file);
      setLocation({ ...diagnostic, nonce: Date.now() });
    }
  };
  const run = async (
    mode: "compile" | "preview" | "publish" | "disable" | "rollback",
    hash?: string,
  ) => {
    const startedAt = revision.current;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const graph = recoverRuleGraph(draft);
      const project = graph && ["compile", "preview", "publish"].includes(mode) ? toGraphSourceProject(graph) : { files: draft.files, entry: draft.entry };
      if (mode === "rollback")
        acceptSnapshot(await arenaApi.rollbackScript(session!, hash!));
      else if (mode === "disable")
        acceptSnapshot(await arenaApi.disableScript(session!));
      else if (mode === "publish") {
        const result = await arenaApi.publishScript(session!, project);
        if (startedAt === revision.current) setCompilation(result.compilation);
        if (result.snapshot) {
          acceptSnapshot(result.snapshot);
          setDraft((current) => {
            if (startedAt !== revision.current) return current;
            const next = {
              ...current,
              baseVersion: result.compilation.bundle!.sourceHash,
            };
            localStorage.setItem(draftKey(session), JSON.stringify(next));
            return next;
          });
        }
      } else if (mode === "compile") {
        const result = await arenaApi.compile(session!, project);
        if (startedAt === revision.current) setCompilation(result);
      } else {
        const result = await arenaApi.preview(session!, project);
        if (startedAt === revision.current) {
          setCompilation(result.compilation);
          setPreview(result);
        }
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return {
    draft,
    compilation,
    preview,
    busy,
    error,
    edit,
    run,
    ready,
    session,
    selectFile,
    addFile,
    setEntry,
    loadProject,
    editProject,
    restoreDraft,
    jump,
    location,
  };
}
