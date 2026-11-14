import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import type { RuleSourceProject, RuleVersionList, RuleVersionSource } from "./scriptTypes";
import type { RuleDraft } from "./ruleDraft";

const MonacoRuleDiff = lazy(() => import("./MonacoRuleDiff"));
export function ScriptHistory({ draft, busy, onLoad, onRestore }: {
  draft: RuleDraft;
  busy: boolean;
  onLoad: (project: RuleSourceProject, hash: string) => void;
  onRestore: (hash: string) => void;
}) {
  const { session, player, ready } = useArena();
  const [history, setHistory] = useState<RuleVersionList>({ activeSourceHash: null, versions: [] });
  const [selected, setSelected] = useState<RuleVersionSource | null>(null);
  const [error, setError] = useState("");
  const [comparing, setComparing] = useState(false);
  const [file, setFile] = useState("");
  const selectionRequest = useRef(0);
  useEffect(() => {
    if (!session) return;
    let current = true;
    arenaApi.scriptVersions(session).then(value => { if (current) setHistory(value); })
      .catch(cause => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [session, player?.script?.sourceHash, player?.script?.publishedAtTick]);
  const select = async (hash: string) => {
    const request = ++selectionRequest.current;
    setError("");
    try {
      const result = await arenaApi.scriptVersion(session!, hash);
      if (request !== selectionRequest.current) return;
      setSelected(result); setFile(result.version.entry);
    } catch (cause) { if (request === selectionRequest.current) setError((cause as Error).message); }
  };
  const files = [...new Set([...Object.keys(selected?.project.files ?? {}), ...Object.keys(draft.files)])];
  return <details className="script-history">
    <summary>版本历史与差异 <span>{history.versions.length} 个版本</span></summary>
    <p>恢复版本切换战场规则；载入源码替换本机草稿。历史包保留原始文件与编译结果。</p>
    <label className="script-history-select">历史版本
      <select aria-label="规则历史版本" value={selected?.version.sourceHash ?? ""}
        onChange={event => void select(event.target.value)}>
        <option value="" disabled>选择已发布版本</option>
        {history.versions.map(version => <option key={version.sourceHash} value={version.sourceHash}>
          {version.sourceHash.slice(0, 12)} · T{version.createdAtTick}
          {version.sourceHash === history.activeSourceHash ? " · 当前生效" : ""}
        </option>)}
      </select>
    </label>
    {error && <p role="alert">{error}</p>}
    {selected && <>
      <p>入口 {selected.version.entry} · {Object.keys(selected.project.files).length} 个文件
        {selected.version.parentSourceHash && ` · 父版本 ${selected.version.parentSourceHash.slice(0, 12)}`}</p>
      <div className="script-history-actions">
        <button disabled={busy} onClick={() => onLoad(selected.project, selected.version.sourceHash)}>载入为草稿</button>
        <button disabled={busy || !ready || selected.version.sourceHash === history.activeSourceHash}
          onClick={() => onRestore(selected.version.sourceHash)}>恢复此版本</button>
        <label><input type="checkbox" checked={comparing}
          onChange={event => setComparing(event.target.checked)} />查看与草稿差异</label>
      </div>
      {comparing && <>
        <select aria-label="对比源码文件" value={file} onChange={event => setFile(event.target.value)}>
          {files.map(name => <option key={name}>{name}</option>)}
        </select>
        <p>原文：历史版本 · 修改：当前草稿</p>
        <Suspense fallback={<p>正在展开源码差异…</p>}>
          <MonacoRuleDiff original={selected.project.files[file] ?? ""} modified={draft.files[file] ?? ""} fileName={file} />
        </Suspense>
      </>}
    </>}
    {!history.versions.length && <p>发布第一份规则后，这里会保留源码与版本关系。</p>}
  </details>;
}
