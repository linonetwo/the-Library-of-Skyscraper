import { lazy, Suspense, useState } from "react";
import { customModuleEditorProject, diagnoseCustomModule, type CustomModuleDefinition, type CustomModuleDraft } from "../../../../behavior-modules/graph";
import { arenaApi } from "../../arenaApi";
import type { CompileResult } from "../../scriptTypes";
import type { Session } from "../../types";
import { DefinitionShapeFields } from "./DefinitionShapeFields";
const MonacoRuleEditor = lazy(() => import("../../MonacoRuleEditor"));
const diagnosticNames: Record<string, string> = { "definition-id": "模块需要稳定标识", name: "请填写模块名称", source: "请填写行为 TypeScript", "field-key": "参数键须为唯一 TypeScript 标识符", "field-bounds": "请调整数值上下限", "field-default": "默认值须符合参数类型和范围", "exit-key": "出口键须为唯一 TypeScript 标识符" };
export function CustomDefinitionEditor({ draft, session, saving, error, onChange, onSave, onClose }: {
  draft: CustomModuleDraft; session: Session | null; saving: boolean; error: string;
  onChange: (draft: CustomModuleDraft) => void; onSave: () => Promise<CustomModuleDefinition | undefined>; onClose: () => void;
}) {
  const [view, setView] = useState<"shape" | "source">("shape");
  const [compiling, setCompiling] = useState(false);
  const [compilation, setCompilation] = useState<{ draft: CustomModuleDraft; result: CompileResult }>();
  const [compileError, setCompileError] = useState("");
  const [location, setLocation] = useState<{file: string; line: number; column: number; nonce: number}>();
  const [saved, setSaved] = useState<{ draft: CustomModuleDraft; definition: CustomModuleDefinition }>();
  const diagnostics = diagnoseCustomModule(draft);
  const { project, activeFile } = customModuleEditorProject(draft);
  const result = compilation?.draft === draft ? compilation.result : null;
  const currentSaved = saved?.draft === draft ? saved.definition : null;
  const check = async () => {
    if (!session) return;
    setCompiling(true); setCompileError("");
    try { setCompilation({ draft, result: await arenaApi.compile(session, project) }); }
    catch (cause) { setCompileError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setCompiling(false); }
  };
  return <section className="custom-definition-editor" aria-label="编辑模块本体">
    <header><h3>编辑模块本体</h3><button disabled={saving || compiling} onClick={onClose}>返回我的模块</button></header>
    <p>保存为个人目录中的版本；图中已有实例保留其原版本。</p>
    <fieldset disabled={saving || compiling}>
      <label>模块名称<input aria-label="自定义模块名称" value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></label>
      <div role="tablist" aria-label="模块本体编辑视图">
        <button role="tab" aria-selected={view === "shape"} onClick={() => setView("shape")}>参数与出口</button>
        <button role="tab" aria-selected={view === "source"} onClick={() => setView("source")}>行为 TypeScript</button>
      </div>
      {view === "shape" ? <DefinitionShapeFields draft={draft} onChange={onChange} /> : <>
        <p><code>{activeFile}</code> · 输入参数和出口类型由当前定义生成。</p><p>返回动作、保持、走原后备或命名出口；模块自述会随录制保存。</p>
        <Suspense fallback={<p>正在加载模块源码编辑器…</p>}><MonacoRuleEditor files={project.files} activeFile={activeFile} onChange={source => onChange({ ...draft, source })} diagnostics={result?.diagnostics ?? []} location={location} /></Suspense>
      </>}
    </fieldset>
    {diagnostics.length > 0 && <ul role="alert">{diagnostics.map((item, index) => <li key={index}>{diagnosticNames[item.code] ?? item.message}{item.key ? ` · ${item.key}` : ""}</li>)}</ul>}
    {(error || compileError) && <p role="alert">{error || compileError}</p>}
    <div className="module-actions">
      <button disabled={!session || compiling || saving || !!diagnostics.length} onClick={() => void check()}>{compiling ? "检查中…" : "检查模块 TypeScript"}</button>
      <button disabled={saving || compiling || !!diagnostics.length} onClick={() => void onSave().then(definition => { if (definition) setSaved({ draft, definition }); })}>{saving ? "保存中…" : "保存到我的模块"}</button>
    </div>
    {result && <div aria-label="模块源码检查结果">{result.diagnostics.length ? result.diagnostics.map((item, index) => <button key={index} onClick={() => { setView("source"); setLocation({ ...item, nonce: Date.now() }); }}>{item.file}:{item.line}:{item.column} · {item.message}</button>) : <p>TypeScript 检查通过。</p>}</div>}
    {currentSaved && <p role="status">已保存「{currentSaved.name}」· 版本 {currentSaved.revisionId.slice(0, 12)}，可从我的模块添加实例。</p>}
  </section>;
}
