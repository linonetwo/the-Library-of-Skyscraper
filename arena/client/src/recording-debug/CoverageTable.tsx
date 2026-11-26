import type { RuleGraph } from '../../../behavior-modules/graph';
import type { RecordingIndex } from './index';
import { nodeCoverage, type NamedRecordingRange } from './coverage';
import { moduleCoverage } from './modules';
import type { RecordingFilter } from './selection';

export function CoverageTable({index, range, graph, actorId, target, onLocate}: {
  index: RecordingIndex; range: NamedRecordingRange; graph: RuleGraph; actorId: string;
  target: 'node' | 'module'; onLocate: (operation: number, filter: Pick<RecordingFilter, 'objectId' | 'kind'>) => void;
}) {
  const count = (operations: number[], objectId: string, kind: RecordingFilter['kind'], label: string, total = operations.length) =>
    operations.length ? <button aria-label={`${objectId} ${label} ${total}`} title={`定位首条原操作 ${operations[0]}`}
      onClick={() => onLocate(operations[0], {objectId, kind})}>{total}</button> : <span>{total}</span>;
  return <div className="recording-coverage-scroll"><p>区间 {range.name} · 操作 {range.fromOperation}–{range.toOperation} · {actorId}</p><table aria-label="具名录制覆盖计数"><thead><tr>
    <th>{target === 'node' ? '归档图节点' : '归档模块实例'}</th><th>访问</th><th>命中</th><th>回退</th><th>未访问 / 未记录</th>
  </tr></thead><tbody>{(target === 'node' ? graph.nodes : graph.modules).map(object => {
    const id = 'id' in object ? object.id : object.moduleId;
    const modules = moduleCoverage(index, range, {actorId, ...(target === 'node' ? {nodeId: id} : {moduleId: id})});
    const nodes = nodeCoverage(index, range, actorId, id);
    const moduleFacts = target === 'module';
    return <tr key={id}><th scope="row">{id}</th>
      <td>{count(moduleFacts ? modules.visitOperations : nodes.visitOperations, id, 'visit', '访问', moduleFacts ? modules.visitCount : nodes.visitCount)}</td>
      <td>{count(moduleFacts ? modules.hitOperations : nodes.selectedOperations, id, 'hit', '命中', moduleFacts ? modules.hitCount : nodes.selectedOperations.length)}</td>
      <td>{moduleFacts || ('type' in object && object.type === 'module') ? count(modules.fallbackOperations, id, 'fallback', '回退', modules.fallbackCount) : '—'}</td>
      <td>{moduleFacts ? <>
        未访问 {count(modules.unvisitedOperations, id, 'visit', '未访问')} · 旧字段缺失 {count(modules.missingModuleOperations, id, 'visit', '缺记录')}
        {' · '}截断 {count(modules.truncatedOperations, id, 'visit', '截断')}
      </> : <>未记录访问 {count(nodes.noRecordedVisitOperations, id, 'visit', '未记录访问')}</>}
        {' · '}路径缺失 {count(nodes.missingTraceOperations, id, 'visit', '路径缺失')}</td>
    </tr>;
  })}</tbody></table></div>;
}
