const reasons: Record<string, string> = {
  "actor downed": "角色倒地，任务停止",
  "low HP; returning to base for recovery": "生命低于阈值，正在返回据点恢复",
  "resources exhausted or cargo full": "资源耗尽或负重已满",
  "clear visible guardians before construction": "先由护卫清除房间守卫",
  "building complete": "建筑已完成，可安排驻守或其他任务",
  "catalog must be built at objective room-3": "编目台需要建在目标书库",
  "catalog not built": "尚未建成编目台",
  "catalog destroyed": "编目台已被摧毁",
  "enemies present": "敌人仍在场，编目暂停",
  "no living allied actor present": "需要存活队员驻守",
};
export function reasonName(value: string | null | undefined) {
  if (!value) return "";
  const materials = /^need (\d+) deposited materials$/.exec(value);
  return (
    reasons[value] ?? (materials ? `需要 ${materials[1]} 已入库建材` : value)
  );
}
