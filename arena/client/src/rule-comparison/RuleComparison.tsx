import { useEffect, useRef, useState } from 'react';
import { arenaApi } from '../arenaApi';
import type { Session } from '../types';
import type { RuleSourceProject, RuleVersionList } from '../scriptTypes';
import type { ReplayTimeline } from '../useReplay';
import { getGraphSourceRef, recoverRuleGraph, toGraphSourceProject } from '../../../behavior-modules/graph';
import type { ComparisonCandidate, RuleComparisonResult } from './types';
import { TraceView } from './TraceView';
import './comparison.css';

type Captured = {result: RuleComparisonResult; a: RuleSourceProject; b: RuleSourceProject};
type SourceView = {hash: string; file: string; line: number; text: string};
const cloneProject = (project: RuleSourceProject): RuleSourceProject => ({...project, files:{...project.files}});
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

export function RuleComparison({session, draftProject}: {
  session: Session; draftProject: RuleSourceProject;
  onLocate?: (objectId: string, sourceHash: string) => void;
}) {
  const initialDraft = useRef(cloneProject(draftProject));
  const [timeline, setTimeline] = useState<ReplayTimeline | null>(null);
  const [versions, setVersions] = useState<RuleVersionList | null>(null);
  const [operationIndex, setOperationIndex] = useState(0);
  const [baselineHash, setBaselineHash] = useState('');
  const [capture, setCapture] = useState<Captured | null>(null);
  const [source, setSource] = useState<SourceView | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const draftSignature = JSON.stringify(draftProject);

  useEffect(() => { generation.current++; setCapture(null); setSource(null); setBusy(false); }, [draftSignature, operationIndex, baselineHash]);
  useEffect(() => {
    let alive = true; generation.current++; initialDraft.current = cloneProject(draftProject);
    setTimeline(null); setVersions(null); setCapture(null); setSource(null); setBusy(false); setError(''); setLoading(true);
    void Promise.all([arenaApi.timeline(session), arenaApi.scriptVersions(session)]).then(([recording, list]) => {
      if (!alive) return;
      setTimeline(recording); setVersions(list); setOperationIndex(recording.frames.at(-1)?.operationIndex ?? 0);
      setBaselineHash(list.activeSourceHash ?? list.versions[0]?.sourceHash ?? '');
    }, cause => {if (alive) setError(message(cause));}).finally(() => {if(alive) setLoading(false);});
    return () => {alive = false; generation.current++;};
  }, [session.sessionId, session.token]);

  async function refresh() {
    const revision = ++generation.current; setLoading(true); setCapture(null); setSource(null); setBusy(false); setError('');
    try {
      const [recording, list] = await Promise.all([arenaApi.timeline(session), arenaApi.scriptVersions(session)]);
      if (revision !== generation.current) return;
      setTimeline(recording); setVersions(list); setOperationIndex(recording.frames.at(-1)?.operationIndex ?? 0);
    } catch(cause) {if(revision === generation.current) setError(message(cause));}
    finally {if(revision === generation.current) setLoading(false);}
  }
  async function compare() {
    const revision = ++generation.current; setBusy(true); setError(''); setCapture(null); setSource(null);
    try {
      const graph = recoverRuleGraph(draftProject);
      const b = graph ? toGraphSourceProject(graph) : cloneProject(draftProject);
      const baseline = baselineHash ? (await arenaApi.scriptVersion(session, baselineHash)).project : cloneProject(initialDraft.current);
      const aGraph = recoverRuleGraph(baseline);
      const a = aGraph ? toGraphSourceProject(aGraph) : baseline;
      if (revision !== generation.current) return;
      const result = await arenaApi.compareRules(session, {operationIndex, initialState:'empty', a, b});
      if (revision === generation.current) setCapture({result, a, b});
    } catch(cause) {if(revision === generation.current) setError(message(cause));}
    finally {if(revision === generation.current) setBusy(false);}
  }
  function locate(project: RuleSourceProject, hash: string, objectId?: string) {
    const ref = objectId ? getGraphSourceRef(project, objectId) : null;
    if (objectId && !ref) {setError(`该版本没有对象 ${objectId} 的源码位置。`); return;}
    const file = ref?.file ?? project.entry ?? Object.keys(project.files)[0];
    setSource({hash, file, line:ref?.line ?? 1, text:project.files[file] ?? ''});
  }
  async function locateHistorical(hash: string, objectId?: string) {
    const revision = generation.current;
    try {const archived = await arenaApi.scriptVersion(session, hash); if(revision === generation.current) locate(archived.project, hash, objectId);}
    catch(cause) {if(revision === generation.current) setError(message(cause));}
  }
  const frame = timeline?.frames.find(frame => frame.operationIndex === operationIndex);
  const recorded = timeline?.ruleHistory?.changes.find(change => change.operationIndex === operationIndex && !('reset' in change));
  const history = recorded && !('reset' in recorded) ? recorded : null;
  const historyTrace = history?.memoryPatch?.set?.aiTrace;
  const result = capture?.result;
  const intentsA = result?.a.execution?.decision?.intents ?? [];
  const intentsB = result?.b.execution?.decision?.intents ?? [];
  const actorIds = [...new Set([...intentsA, ...intentsB].map(intent => intent.actorId))];
  function candidate(side: 'a' | 'b', value: ComparisonCandidate, project: RuleSourceProject) {
    const failed = value.error || value.execution?.failure?.message;
    return <article className="comparison-candidate" aria-label={`${side.toUpperCase()}版结果`}>
      <h4>{side === 'a' ? 'A · 基线' : 'B · 当前草稿'}</h4>
      <code>{value.sourceHash ?? '未生成版本哈希'}</code>
      {value.sourceHash && <button onClick={() => locate(project, value.sourceHash!)}>只读源码</button>}
      {failed && <p role="alert">{failed}</p>}
      {value.compilation?.diagnostics.map((d, i) => <p key={i}>{d.severity} · {d.file}:{d.line}:{d.column} · {d.message}</p>)}
      {value.execution?.decision && !failed && <>
        <TraceView value={value.execution.decision.memoryPatch?.set?.aiTrace} locate={id => locate(project, value.sourceHash!, id)} />
        <details open><summary>本次意图</summary><pre>{JSON.stringify(value.execution.decision.intents, null, 2)}</pre></details>
      </>}
    </article>;
  }
  return <section className="rule-comparison" aria-label="同帧规则对照">
    <h3>下一次决策比较</h3>
    <p>操作N后，同一世界与本人录制任务；A/B双方从空记忆开始。只试算下一次选择，不推进远征或写入状态。</p>
    <div className="comparison-controls">
      <label>录制操作N <input aria-label="录制操作N" type="number" min={0} max={timeline?.frames.at(-1)?.operationIndex ?? 0} value={operationIndex} disabled={loading} onChange={e => setOperationIndex(Number(e.target.value))} /></label>
      <span>{frame ? `操作${frame.operationIndex}后 · tick ${frame.tick}` : '请选择可访问的操作帧'}</span>
      <button onClick={() => void refresh()} disabled={loading}>刷新实录与版本</button>
      <label>A基线 <select aria-label="A基线版本" value={baselineHash} onChange={e => setBaselineHash(e.target.value)}>
        <option value="">打开面板时的草稿副本</option>
        {versions?.versions.map(version => <option key={version.sourceHash} value={version.sourceHash}>{version.sourceHash.slice(0,12)} · tick {version.createdAtTick}</option>)}
      </select></label>
      <span>B：当前草稿</span>
      <button disabled={busy || loading || !frame} onClick={() => void compare()}>{busy ? '两版试算中…' : '比较同一操作帧'}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <details className="comparison-history"><summary>原始录制选择 · 操作{operationIndex}</summary>
      {history?.sourceHash ? <>
        <p>来自实际录制 · tick {history.tick} · <code>{history.sourceHash}</code></p>
        <button onClick={() => void locateHistorical(history.sourceHash!)}>该版只读源码</button>
        <TraceView value={historyTrace} locate={id => void locateHistorical(history.sourceHash!,id)} />
      </> : <p>该操作没有可用的本人规则选择记录；旧版本也可能没有图路径。</p>}
    </details>
    {capture && result && <>
      <p role="status">操作{result.operationIndex}后 · tick {result.tick} · 本人{result.ownerId} · 两版空记忆</p>
      <details><summary>双方共同输入</summary><pre>{JSON.stringify(result.context,null,2)}</pre></details>
      <div className="comparison-columns">{candidate('a',result.a,capture.a)}{candidate('b',result.b,capture.b)}</div>
      <h4>意图差异</h4>
      {actorIds.length ? <table><thead><tr><th>角色</th><th>A</th><th>B</th></tr></thead><tbody>{actorIds.map(id => <tr key={id}><th>{id}</th><td>{intentsA.filter(i => i.actorId === id).map(i => i.type).join('、') || '无意图'}</td><td>{intentsB.filter(i => i.actorId === id).map(i => i.type).join('、') || '无意图'}</td></tr>)}</tbody></table> : <p>两版均无可用意图；请结合诊断与失败信息查看。</p>}
    </>}
    {source && <details open className="comparison-source"><summary>只读版本 {source.hash} · {source.file}:{source.line}</summary><pre>{source.text.split('\n').map((line,i) => <span key={i} className={i+1===source.line ? 'source-selected' : ''}>{String(i+1).padStart(3)} {line}{'\n'}</span>)}</pre></details>}
  </section>;
}
