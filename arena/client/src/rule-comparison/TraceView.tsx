import type { GraphTrace } from '../../../behavior-modules/graph';
export function graphTrace(value: unknown): GraphTrace | null {
  if (!value || typeof value !== 'object') return null;
  const trace = value as Partial<GraphTrace>;
  if (trace.v !== 2 || !Array.isArray(trace.actors)) return null;
  const valid = trace.actors.every(actor => actor && typeof actor === 'object'
    && typeof actor.actorId === 'string' && typeof actor.startStateId === 'string'
    && typeof actor.endStateId === 'string' && typeof actor.reason === 'string'
    && (actor.transitionId === null || typeof actor.transitionId === 'string')
    && (actor.selectedNodeId === null || typeof actor.selectedNodeId === 'string')
    && (actor.moduleId === null || typeof actor.moduleId === 'string')
    && Array.isArray(actor.visited) && actor.visited.every(node => node && typeof node === 'object'
      && typeof node.nodeId === 'string' && (node.value === undefined || typeof node.value === 'boolean'
        || (typeof node.value === 'number' && Number.isFinite(node.value)))));
  return valid ? trace as GraphTrace : null;
}
export function TraceView({value, locate}: {value: unknown; locate: (id: string) => void}) {
  const trace = graphTrace(value);
  if (!trace) return <p>该版本没有规则图路径记录。可查看原版源码及意图。</p>;
  return <div className="comparison-traces">{trace.actors.map(actor => <article key={actor.actorId}>
    <strong>{actor.actorId}</strong>
    <p>{actor.startStateId} → {actor.endStateId}{actor.transitionId && <> · 转移 <button onClick={() => locate(actor.transitionId!)}>{actor.transitionId}</button></>}</p>
    <p>访问：{actor.visited.map((node, index) => <button key={`${node.nodeId}-${index}`} onClick={() => locate(node.nodeId)}>{node.nodeId}{node.value !== undefined ? ` = ${String(node.value)}` : ''}</button>)}</p>
    <p>选择：{actor.selectedNodeId ? <button onClick={() => locate(actor.selectedNodeId!)}>{actor.selectedNodeId}</button> : '无节点'} · 模块 {actor.moduleId ?? '无'}</p>
    <p>{actor.reason}</p>
  </article>)}</div>;
}
