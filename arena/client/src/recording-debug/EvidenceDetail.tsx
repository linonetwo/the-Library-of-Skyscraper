import type { RecordingEvidence } from './selection';
const reasonLabels: Record<string, string> = {
  'custom-selected': '自定义模块提议动作',
  'custom-hold': '自定义模块保持',
  'custom-exit': '走已连接的命名出口',
  'custom-unconnected-exit': '命名出口走本叶后备',
  'escort-target-missing': '未解析到符合条件的目标',
  'escort-cargo-insufficient': '队友货量不足',
  'travel-active': '已有行程，保持在途',
  'scout-reported': '到场观察已报告',
  'patrol-dwelling': '巡逻到场驻留',
  'official-selected': '本模块已选择动作',
  'official-unavailable': '本模块未产生动作',
  'disabled': '模块已禁用',
  'role-filtered': '岗位不匹配',
  'room-missing': '指定房间不存在',
  'risk-exceeded': '房间风险超过阈值',
  'route-unavailable': '没有可用路线',
  'moving': '提出移动意图',
  'scout-report-cooldown': '未到报告间隔',
  'patrol-advanced': '推进下一巡逻站点',
  'escort-safe': '目标同房且安全',
  'escort-defending': '同房威胁触发守卫响应',
};

export function EvidenceDetail({selection, sceneTick}: {selection: RecordingEvidence | null; sceneTick?: number}) {
  if (!selection) return <p>当前操作：所选对象未记录路径事实。</p>;
  const fact = selection.fact;
  return <article aria-label="录制命中事实"><p>操作 {fact.operationIndex} · 决策 T{fact.tick} → 场景 T{sceneTick ?? '未记录'} · {fact.actorId}</p>
    {selection.kind === 'module' ? <>
      <p>模块 {selection.fact.visit.moduleId} · 节点 {selection.fact.visit.nodeId}</p>
      <p>结果 {{selected:'规则选择',fallback:'回退',hold:'保持'}[selection.fact.visit.outcome]} · 原因 {reasonLabels[selection.fact.visit.reasonCode] ?? selection.fact.visit.reasonCode} <small>({selection.fact.visit.reasonCode})</small></p>
      {selection.fact.visit.exitKey && <p>命名出口 {selection.fact.visit.exitKey} → {selection.fact.visit.fallbackNodeId ?? '未记录'}</p>}
      {selection.fact.visit.reason && <p>模块自述：{selection.fact.visit.reason}</p>}
      {selection.fact.visit.observed?.cargo !== undefined && <p>当时货量 {selection.fact.visit.observed.cargo} / 需要 {selection.fact.visit.observed.threshold ?? '未记录'}</p>}
      {selection.fact.visit.observed?.enemyHp !== undefined && <p>当时敌方HP {selection.fact.visit.observed.enemyHp} / 可容忍 {selection.fact.visit.observed.threshold ?? '未记录'}</p>}
      <dl><dt>原始引用</dt><dd><code>{JSON.stringify(selection.fact.visit.ref) ?? '未记录'}</code></dd>
        <dt>当时解析目标 / 参与判断候选</dt><dd>{selection.fact.visit.resolvedId ?? '未记录'}</dd>
        <dt>当时事实与阈值</dt><dd><code>{JSON.stringify(selection.fact.visit.observed) ?? '未记录'}</code></dd>
        <dt>回退节点</dt><dd>{selection.fact.visit.fallbackNodeId ?? '未记录'}</dd></dl>
    </> : <>
      <p>节点 {selection.fact.nodeId} · 访问 {selection.fact.visits.length} 次 · {selection.fact.selected ? '已选择' : '未选择'}</p>
      <p>原比较值 {selection.fact.visits.map(visit => visit.value === undefined ? '未记录' : String(visit.value)).join(' / ') || '未记录'}</p>
    </>}
    <p>记录状态：{selection.kind === 'module' ? '模块访问已记录' : '节点决策已记录'}</p>
  </article>;
}
