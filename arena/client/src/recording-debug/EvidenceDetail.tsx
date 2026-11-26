import type { RecordingEvidence } from './selection';
const reasonLabels: Record<string, string> = {
  'escort-target-missing': '未解析到符合条件的目标',
  'escort-cargo-insufficient': '队友货量不足',
  'travel-active': '已有行程，保持在途',
  'scout-reported': '到场观察已报告',
  'patrol-dwelling': '巡逻到场驻留',
};

export function EvidenceDetail({selection, sceneTick}: {selection: RecordingEvidence | null; sceneTick?: number}) {
  if (!selection) return <p>该操作没有所选对象的对应路径事实；可查看原回放与该版源码。</p>;
  const fact = selection.fact;
  return <article aria-label="录制命中事实"><p>操作 {fact.operationIndex} · 决策 T{fact.tick} → 场景 T{sceneTick ?? '未记录'} · {fact.actorId}</p>
    {selection.kind === 'module' ? <>
      <p>模块 {selection.fact.visit.moduleId} · 节点 {selection.fact.visit.nodeId}</p>
      <p>结果 {selection.fact.visit.outcome} · 原因 {reasonLabels[selection.fact.visit.reasonCode] ?? selection.fact.visit.reasonCode} <small>({selection.fact.visit.reasonCode})</small></p>
      {selection.fact.visit.observed?.cargo !== undefined && <p>当时货量 {selection.fact.visit.observed.cargo} / 需要 {selection.fact.visit.observed.threshold ?? '未记录'}</p>}
      <dl><dt>原始引用</dt><dd><code>{JSON.stringify(selection.fact.visit.ref) ?? '未记录'}</code></dd>
        <dt>当时解析目标 / 参与判断候选</dt><dd>{selection.fact.visit.resolvedId ?? '未记录'}</dd>
        <dt>当时事实与阈值</dt><dd><code>{JSON.stringify(selection.fact.visit.observed) ?? '未记录'}</code></dd>
        <dt>回退节点</dt><dd>{selection.fact.visit.fallbackNodeId ?? '未记录'}</dd></dl>
    </> : <>
      <p>节点 {selection.fact.nodeId} · 访问 {selection.fact.visits.length} 次 · {selection.fact.selected ? '已选择' : '未选择'}</p>
      <p>原比较值 {selection.fact.visits.map(visit => visit.value === undefined ? '未记录' : String(visit.value)).join(' / ') || '未记录'}</p>
    </>}
    <p>这是该版规则的真实访问/选择。权威拒绝、后拍到达或采集结果请查看原回放事件。</p>
  </article>;
}
