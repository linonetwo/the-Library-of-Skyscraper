import { lazy, Suspense, useState } from "react";
import { Code2, Play, ArrowLeft } from "lucide-react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import type { CompileResult, ScriptPreview } from "./scriptTypes";
import "./styles/scripts.css";

const MonacoRuleEditor = lazy(() => import("./MonacoRuleEditor"));
const initialSource = `import type { RuleContext, RuleDecisionResult } from "@skyscraper/arena-script-sdk";

// 将小队召回中庭；修改 roomId 可以改变目标。
export function decide(ctx: RuleContext): RuleDecisionResult {
  return {
    intents: ctx.squad.actors
      .filter(actor => actor.roomId !== "room-0")
      .map(actor => ({
        type: "move",
        actorId: actor.id,
        roomId: "room-0",
        priority: 50,
        reason: "回到中庭集结",
      })),
  };
}
`;
export default function ScriptWorkbench({ onBack }: { onBack: () => void }) {
  const { session } = useArena();
  const [source, setSource] = useState(() => localStorage.getItem("arena-rule-draft") ?? initialSource);
  const [compilation, setCompilation] = useState<CompileResult | null>(null);
  const [preview, setPreview] = useState<ScriptPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = (value: string) => {
    setSource(value); localStorage.setItem("arena-rule-draft", value);
    setCompilation(null); setPreview(null);
  };
  const run = async (mode: "compile" | "preview") => {
    setBusy(true); setError(""); setPreview(null);
    try {
      const project = { files: { "main.ts": source }, entry: "main.ts" };
      if (mode === "compile") setCompilation(await arenaApi.compile(session!, project));
      else {
        const result = await arenaApi.preview(session!, project);
        setCompilation(result.compilation); setPreview(result);
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="script-workbench">
    <header><div><span className="eyebrow">RULE STUDIO · TYPESCRIPT</span>
      <h2>用代码编织下一步。</h2></div>
      <button onClick={onBack}><ArrowLeft size={14} />行动预设</button></header>
    <p>编辑 → 编译 → 当前快照试跑。草稿保存在本机；试跑输出动作意图，发布功能接入中。</p>
    <div className="script-filebar"><Code2 size={15} /><span>main.ts</span><small>竞技场 SDK · v0</small></div>
    <Suspense fallback={<div className="script-monaco">正在展开代码工作台…</div>}>
      <MonacoRuleEditor source={source} onChange={edit} diagnostics={compilation?.diagnostics ?? []} />
    </Suspense>
    <div className="script-toolbar">
      <button disabled={!session || busy} onClick={() => void run("compile")}>编译 TypeScript</button>
      <button className="primary" disabled={!session || busy} onClick={() => void run("preview")}>
        <Play size={14} />{busy ? "处理中…" : "试跑当前快照"}</button>
      {compilation?.bundle && <small>版本 {compilation.bundle.sourceHash.slice(0, 12)}</small>}
    </div>
    <section className="script-results" aria-label="脚本运行结果">
      {error && <p role="alert">{error}</p>}
      {compilation?.diagnostics.map((item, index) =>
        <p className="script-diagnostic" key={index}>{item.file}:{item.line}:{item.column} · {item.message}</p>)}
      {compilation?.bundle && <p className="script-success">编译完成 · 类型与入口契约通过</p>}
      {preview?.execution && <p>T{preview.tick} · V8 {preview.execution.durationMs.toFixed(2)} ms</p>}
      {preview?.execution?.failure && <p role="alert">
        {preview.execution.failure.kind} · {preview.execution.failure.message}</p>}
      {preview?.execution?.decision && <>
        <strong>动作意图 {preview.execution.decision.intents.length} 条</strong>
        {preview.execution.decision.intents.map((intent, index) => <div className="intent-row" key={index}>
          <code>{intent.actorId}</code><b>{intent.type}</b><span>{intent.roomId ?? intent.reason}</span>
        </div>)}
      </>}
      {!compilation && !error && <p>输入规则，查看类型提示与当前小队的决策结果。</p>}
    </section>
  </div>;
}
