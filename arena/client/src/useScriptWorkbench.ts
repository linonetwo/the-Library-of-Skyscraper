import { useState } from "react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import type { CompileResult, ScriptPreview } from "./scriptTypes";
import { recallSource } from "./scriptTemplates";

export function useScriptWorkbench() {
  const { session, ready, acceptSnapshot } = useArena();
  const [source, setSource] = useState(() => localStorage.getItem("arena-rule-draft") ?? recallSource);
  const [compilation, setCompilation] = useState<CompileResult | null>(null);
  const [preview, setPreview] = useState<ScriptPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = (value: string) => {
    setSource(value);
    localStorage.setItem("arena-rule-draft", value);
    setCompilation(null);
    setPreview(null);
  };
  const run = async (mode: "compile" | "preview" | "publish" | "disable") => {
    setBusy(true); setError(""); setPreview(null);
    try {
      const project = { files: { "main.ts": source }, entry: "main.ts" };
      if (mode === "disable") acceptSnapshot(await arenaApi.disableScript(session!));
      else if (mode === "publish") {
        const result = await arenaApi.publishScript(session!, project);
        setCompilation(result.compilation);
        if (result.snapshot) acceptSnapshot(result.snapshot);
      } else if (mode === "compile") setCompilation(await arenaApi.compile(session!, project));
      else {
        const result = await arenaApi.preview(session!, project);
        setCompilation(result.compilation); setPreview(result);
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  return { source, compilation, preview, busy, error, edit, run, ready, session };
}
