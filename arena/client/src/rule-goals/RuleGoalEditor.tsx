import { useState } from 'react';
import type { GraphPatch, RuleGraph } from '../../../behavior-modules/graph/types';
import { diagnoseGraph } from '../../../behavior-modules/graph/diagnostics';
import { applyGraphPatch, inverseGoalPatch, proposeGoals, selectedGoalPatch } from './goals';
import type { GoalProposal } from './goals';
import './rule-goals.css';

export interface RuleGoalEditorProps { graph: RuleGraph; onApply: (patch: GraphPatch) => void; onLocate: (objectId: string) => void }
export function RuleGoalEditor({ graph, onApply, onLocate }: RuleGoalEditorProps) {
  const [text, setText] = useState('采撷师载量到6就回仓');
  const [proposal, setProposal] = useState<GoalProposal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState<{ expected: string; patch: GraphPatch } | null>(null);
  function propose() {
    const next = proposeGoals(graph, text);
    setProposal(next); setSelected(next.changes.map(change => change.id));
    setMessage(next.changes.length ? '差异尚未采纳，当前图和运行版本未变化' : '没有可采纳的差异');
  }
  function accept() {
    if (!proposal) return;
    try {
      const patch = selectedGoalPatch(graph, proposal, selected);
      const result = applyGraphPatch(graph, patch);
      const errors = diagnoseGraph(result).filter(item => item.severity === 'error');
      if (errors.length) throw new Error(errors.map(item => `${item.objectId}：${item.message}`).join('；'));
      onApply(patch);
      setUndo({ expected: JSON.stringify(result), patch: inverseGoalPatch(graph, result, patch) });
      setProposal(null); setSelected([]); setMessage(`已采纳${patch.operations.length}项到草稿，尚未发布`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  function revert() {
    if (!undo) return;
    try {
      if (JSON.stringify(graph) !== undo.expected) throw new Error('采纳后图已变化，请使用工作台的草稿撤销，或重新生成目标差异');
      onApply(undo.patch); setUndo(null); setProposal(null); setMessage('已撤销本次目标改动，尚未发布');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  return <section className="rule-goals" aria-label="中文目标与补丁">
    <h3>中文目标</h3>
    <p>只解析下方明确语法。提案修改所选图的草稿；试跑和发布使用工作台原有按钮。</p>
    <label>目标语句<textarea aria-label="目标语句" value={text} onChange={event => setText(event.target.value)} rows={3}/></label>
    <details><summary>支持的语法与实际影响</summary>
      <p>每行或分号一项。岗位句式只寻找该岗位入口状态的一条匹配转移；不唯一时请指定稳定ID。回仓句式同时列出入口载量条件与转移，可分别采纳。生命低于使用严格小于。</p>
      <pre>{'采撷师载量到6就回仓\n守卷人生命低于20撤退\n条件 cargo-check：载量 >= 12\n转移 low-hp-guarding：HP <= 25\n连接 cargo-check：是→haul-node，否→gather-node\n模块 gather：岗位=采撷师，目标=room-2'}</pre>
      <p>稳定ID及房间ID以当前图为准。共享模块修改会影响所有引用它的节点；不会自动新增撤退路径或猜测未支持动作。</p>
    </details>
    <div className="rule-goal-actions"><button onClick={propose}>生成目标差异</button><button onClick={revert} disabled={!undo}>撤销目标采纳</button></div>
    {proposal && <div aria-label="目标补丁提案" data-baseline-revision={proposal.baseRevision}>
      <p>图 {proposal.graphId} · 基线 r{proposal.baseRevision}</p>
      {proposal.errors.map((error, index) => <p role="alert" key={index}>{error}</p>)}
      {proposal.changes.map(change => <article key={change.id} data-goal-change={change.id}>
        <label><input type="checkbox" aria-label={`采纳 ${change.objectId}`} checked={selected.includes(change.id)} onChange={event => setSelected(values => event.target.checked ? [...values, change.id] : values.filter(id => id !== change.id))}/>{change.objectId}</label>
        <button onClick={() => onLocate(change.objectId)} aria-label={`定位 ${change.objectId}`}>定位对象</button>
        <p>{change.explanation}</p><div><code>{change.before}</code> → <code>{change.after}</code></div>
      </article>)}
      <div className="rule-goal-actions"><button onClick={accept} disabled={!selected.length}>采纳所选差异</button><button onClick={() => { setProposal(null); setSelected([]); setMessage('已拒绝本次提案，图未变化'); }}>拒绝本次提案</button></div>
    </div>}
    <p role="status" aria-label="目标补丁状态">{message}</p>
  </section>;
}
