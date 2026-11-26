import { useMemo, useState } from 'react';
import { getCustomModuleSourceRef, getGraphSourceRef, readArchivedRuleGraph } from '../../../behavior-modules/graph';
import type { Session } from '../types';
import { ReadOnlySource } from '../rule-comparison/ReadOnlySource';
import { indexRecording } from './index';
import type { NamedRecordingRange } from './coverage';
import { loadRanges, saveRange } from './ranges';
import { useRecording } from './useRecording';
import { findRecordingEvidence, type RecordingEvidence, type RecordingFilter } from './selection';
import { CoverageTable } from './CoverageTable';
import { EvidenceDetail } from './EvidenceDetail';
import './recordings.css';

export interface RecordingSelection {sessionId: string; ownerId: string; sourceHash: string; operationIndex: number}
export interface RecordingDebuggerProps {
  session: Session | null;
  onSeekOperation: (selection: RecordingSelection) => void;
  onOpenSource?: (ref: {sourceHash: string; objectId: string}) => void;
}
export function RecordingDebugger(props: RecordingDebuggerProps) {
  return props.session ? <RecordingDebuggerView key={`${props.session.sessionId}:${props.session.playerId}`} {...props} session={props.session} />
    : <section aria-label="录制断点与覆盖"><p>请先打开本人的赛局录制。</p></section>;
}

function RecordingDebuggerView({session, onSeekOperation, onOpenSource}: RecordingDebuggerProps & {session: Session}) {
  const identity = {sessionId: session.sessionId, ownerId: session.playerId};
  const [hash, setHash] = useState('');
  const {recording, archive, loading, sourceHash, error, refresh} = useRecording(session, hash);
  const hashes = recording?.versions.versions.map(version => version.sourceHash) ?? [];
  const timeline = recording?.timeline.sessionId === session.sessionId ? recording.timeline : null;
  const index = useMemo(() => timeline && indexRecording(timeline, session.playerId), [timeline, session.playerId]);
  const project = archive?.version.sourceHash === sourceHash ? archive.project : null;
  const graph = useMemo(() => project && readArchivedRuleGraph(project), [project]);
  const actors = [...new Set(index?.decisions.filter(decision => decision.sourceHash === sourceHash).map(decision => decision.actor.actorId) ?? [])];
  const [actor, setActor] = useState('');
  const actorId = actor || actors[0] || '';
  const [target, setTarget] = useState<'node' | 'module'>('node');
  const objects = graph ? (target === 'node' ? graph.nodes.map(node => node.id) : graph.modules.map(module => module.moduleId)) : [];
  const [object, setObject] = useState('');
  const objectId = objects.includes(object) ? object : objects[0] || '';
  const [kind, setKind] = useState<RecordingFilter['kind']>('visit');
  const [exit, setExit] = useState('');
  const selectedModule = target === 'module' ? graph?.modules.find(module => module.moduleId === objectId) : null;
  const selectedNode = target === 'node' ? graph?.nodes.find(node => node.id === objectId) : null;
  const customBinding = target === 'module' ? selectedModule : selectedNode?.type === 'module' ? graph?.modules.find(module => module.moduleId === selectedNode.moduleId) : null;
  const definition = customBinding?.kind === 'custom' ? graph?.customDefinitions?.find(item => item.definitionId === customBinding.definitionId && item.revisionId === customBinding.revisionId) : null;
  const exitKey = definition?.exits.some(item => item.key === exit) ? exit : '';
  const filter = {sourceHash, actorId, target, objectId, kind, exitKey: exitKey || undefined};
  const [cursor, setCursor] = useState(-1);
  const [selection, setSelection] = useState<RecordingEvidence | null>(null);
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState<{sourceHash: string; objectId: string; kind: "call" | "body"} | null>(null);
  const sourceId = source?.sourceHash === sourceHash ? source.objectId : '';
  const setSourceId = (objectId: string) => setSource(objectId ? {sourceHash, objectId, kind: "call"} : null);
  const activeSelection = selection?.fact.sourceHash === sourceHash && selection.fact.actorId === actorId ? selection : null;
  const [name, setName] = useState('');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [ranges, setRanges] = useState(() => loadRanges(localStorage, identity));
  const lastOperation = timeline?.frames.at(-1)?.operationIndex ?? 0;
  const range: NamedRecordingRange = {...identity, sourceHash, name: name.trim() || '当前区间', fromOperation: from, toOperation: to};
  const validRange = Number.isSafeInteger(from) && Number.isSafeInteger(to) && from >= 0 && to >= from && to <= lastOperation;
  const ref = project && sourceId ? (sourceId === '__entry__' ? {file: project.entry ?? 'main.ts', line: 1} : source?.kind === 'body' ? getCustomModuleSourceRef(project, sourceId) : getGraphSourceRef(project, sourceId)) : null;
  const clear = () => {setExit('');setCursor(-1); setSelection(null); setSourceId(''); setNotice('');};
  const seek = (operationIndex: number, nextFilter = filter) => {
    const frame = timeline?.frames.find(frame => frame.operationIndex === operationIndex);
    if (!index || !frame) {setNotice('这份录制没有该操作帧。'); return;}
    setCursor(operationIndex); setNotice('');
    const evidence = findRecordingEvidence(index, nextFilter, operationIndex - 1, 'next');
    setSelection(evidence?.fact.operationIndex === operationIndex ? evidence : null);
    setSourceId('');
    onSeekOperation({...identity, sourceHash: nextFilter.sourceHash, operationIndex});
  };
  const next = (direction: 'next' | 'previous') => {
    if (!index || !objectId || !actorId) return;
    const fact = findRecordingEvidence(index, filter, direction === 'previous' && cursor < 0 ? lastOperation + 1 : cursor, direction);
    if (fact) seek(fact.fact.operationIndex);
    else setNotice('所选版本、角色和对象没有更多对应记录。');
  };
  const callNodeId = activeSelection?.kind === 'module' ? activeSelection.fact.visit.nodeId : target === 'node' ? objectId : '';
  const callNode = graph?.nodes.find(node => node.id === callNodeId);
  const moduleId = activeSelection?.kind === 'module' ? activeSelection.fact.visit.moduleId : target === 'module' ? objectId : callNode?.type === 'module' ? callNode.moduleId : undefined;
  const bodyRef = project && moduleId ? getCustomModuleSourceRef(project, moduleId) : null;
  const openSource = () => {
    const id = activeSelection?.kind === 'module' ? activeSelection.fact.visit.nodeId : objectId;
    if (onOpenSource) onOpenSource({sourceHash, objectId: id});
    else {setSourceId(id); if (!project || !getGraphSourceRef(project, id)) setNotice('该归档工程没有对象行号；可在原多文件源码中查看手写规则。');}
  };
  return <section className="recording-debugger" aria-label="录制断点与覆盖" data-recording-state={JSON.stringify({sessionId:session.sessionId,ownerId:session.playerId,sourceHash,actorId,target,objectId,kind,exitKey,cursorOperation:cursor})}>
    <header><h3>录制断点与覆盖</h3><button disabled={loading} onClick={refresh}>刷新本人录制</button></header>
    <p>只读原始录制 · 本人 {session.playerId} · 会话 {session.sessionId}。断点定位本地回放游标。</p>
    {loading && <p role="status">读取录制中…</p>}{error && <p role="alert">{error}</p>}
    {!index?.historyAvailable && !loading && <p>这份录制没有本人的规则历史，节点和模块证据未记录。</p>}
    <div className="recording-controls">
      <label>归档版本<select aria-label="录制源版本" value={sourceHash} onChange={e => {setHash(e.target.value);setActor('');setObject('');clear();}}><option value="">请选择</option>{hashes.map(value => <option key={value} value={value}>{value.slice(0,12)}</option>)}</select></label>
      <label>角色<select aria-label="录制角色" value={actorId} onChange={e => {setActor(e.target.value);clear();}}><option value="">请选择</option>{actors.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>对象类型<select aria-label="录制对象类型" value={target} onChange={e => {setTarget(e.target.value as 'node'|'module');setObject('');clear();}}><option value="node">节点</option><option value="module">模块实例</option></select></label>
      <label>归档对象<select aria-label="录制对象" value={objectId} onChange={e => {setObject(e.target.value);clear();}}><option value="">请选择</option>{objects.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>记录种类<select aria-label="录制命中类型" value={kind} onChange={e => {setKind(e.target.value as RecordingFilter['kind']);clear();}}><option value="visit">访问</option><option value="hit">命中（节点选择 / 模块selected或hold）</option><option value="fallback">模块回退</option></select></label>
      {definition && <label>定位命名出口<select aria-label="录制命名出口" value={exitKey} onChange={event => {setExit(event.target.value);setSelection(null);setSourceId('');}}><option value="">全部出口与结果</option>{definition.exits.map(item => <option key={item.key} value={item.key}>{item.label} · {item.key}</option>)}</select></label>}
      <label>原操作游标<input aria-label="录制操作游标" type="number" min={-1} max={lastOperation} value={cursor} onChange={e => {setCursor(Number(e.target.value));setSelection(null);setSourceId('');}} /></label>
      <button disabled={!index || !objectId || !actorId} onClick={() => next('previous')}>上一次记录</button><button disabled={!index || !objectId || !actorId} onClick={() => next('next')}>下一次记录</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    <EvidenceDetail selection={activeSelection} sceneTick={timeline?.frames.find(frame => frame.operationIndex === cursor)?.tick} />
    <button disabled={!project || !objectId} onClick={openSource}>打开该版只读源码</button>
    {bodyRef && moduleId && <div className="module-actions"><button disabled={!callNodeId} onClick={() => setSourceId(callNodeId)}>看调用处</button><button onClick={() => setSource({sourceHash, objectId: moduleId, kind: 'body'})}>看本体源码</button></div>}
    {ref && project && <details open><summary>归档 {sourceHash.slice(0,12)} · {ref.file}:{ref.line}</summary><ReadOnlySource text={project.files[ref.file] ?? ''} line={ref.line} /></details>}
    {!graph && project && <><p>该归档没有可读取的图声明；节点分母与模块覆盖未记录，可查看原版本源码和意图。</p><button onClick={() => setSourceId('__entry__')}>查看该版入口源码</button></>}
    <fieldset><legend>具名操作闭区间</legend>
      <label>名字<input aria-label="具名录制名称" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>从操作<input aria-label="录制区间起点" type="number" min={0} max={lastOperation} value={from} onChange={e => setFrom(Number(e.target.value))} /></label>
      <label>到操作<input aria-label="录制区间终点" type="number" min={0} max={lastOperation} value={to} onChange={e => setTo(Number(e.target.value))} /></label>
      <button disabled={!name.trim() || !sourceHash || !validRange} onClick={() => setRanges(saveRange(localStorage,identity,ranges,range))}>保存具名区间</button>
      <label>已存区间<select aria-label="已存具名录制" value="" onChange={e => {const saved=ranges[Number(e.target.value)];if(saved){setHash(saved.sourceHash);setName(saved.name);setFrom(saved.fromOperation);setTo(saved.toOperation);setActor('');setObject('');clear();}}}><option value="">选择本会话区间</option>{ranges.map((saved,i) => <option key={saved.name} value={i}>{saved.name} · {saved.sourceHash.slice(0,8)} · {saved.fromOperation}–{saved.toOperation}</option>)}</select></label>
      <button onClick={() => {setFrom(0);setTo(lastOperation);}}>使用整份录制操作范围</button>
    </fieldset>
    {index && graph && actorId && validRange && <CoverageTable index={index} range={range} graph={graph} actorId={actorId} target={target} onLocate={(operation, choice) => {setObject(choice.objectId);setKind(choice.kind);seek(operation,{...filter,...choice});}} />}
  </section>;
}
