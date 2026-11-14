import { lazy, Suspense } from "react";
import { Code2, Play, ArrowLeft, Upload } from "lucide-react";
import { ScriptVersion } from "./ScriptVersion";
import { useScriptWorkbench } from "./useScriptWorkbench";
import { scriptTemplates } from "./scriptTemplates";
import "./styles/scripts.css";

const MonacoRuleEditor = lazy(() => import("./MonacoRuleEditor"));
export default function ScriptWorkbench({ onBack }: { onBack: () => void }) {
  const { session, ready, source, compilation, preview, busy, error, edit, run } = useScriptWorkbench();
  return <div className="script-workbench">
    <header><div><span className="eyebrow">RULE STUDIO · TYPESCRIPT</span>
      <h2>用代码编织下一步。</h2></div>
      <button onClick={onBack}><ArrowLeft size={14} />行动预设</button></header>
    <p>编辑 → 试跑 → 发布到战场。草稿保存在本机；已发布版本在每个模拟步驱动小队。</p>
    <ScriptVersion busy={busy} onDisable={() => void run("disable")} />
    <div className="script-filebar"><Code2 size={15} /><span>main.ts</span>
      <select aria-label="载入规则模板" value="" disabled={busy}
        onChange={event => edit(scriptTemplates[event.target.value].source)}>
        <option value="" disabled>载入模板 · 替换草稿</option>
        {Object.entries(scriptTemplates).map(([id, template]) =>
          <option key={id} value={id}>{template.name}</option>)}
      </select>
      <small>竞技场 SDK · v0</small></div>
    <Suspense fallback={<div className="script-monaco">正在展开代码工作台…</div>}>
      <MonacoRuleEditor source={source} onChange={edit} diagnostics={compilation?.diagnostics ?? []} />
    </Suspense>
    <div className="script-toolbar">
      <button disabled={!session || busy} onClick={() => void run("compile")}>编译 TypeScript</button>
      <button disabled={!session || busy} onClick={() => void run("preview")}>
        <Play size={14} />{busy ? "处理中…" : "试跑当前快照"}</button>
      <button className="primary" disabled={!ready || busy} onClick={() => void run("publish")}>
        <Upload size={14} />发布到战场</button>
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
