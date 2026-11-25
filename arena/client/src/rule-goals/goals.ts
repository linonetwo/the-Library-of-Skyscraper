import type { GraphCondition, GraphOperation, GraphPatch, RuleGraph } from '../../../behavior-modules/graph/types';
import { applyGraphPatch } from '../../../behavior-modules/graph/patch';

export interface GoalChange { id: string; objectId: string; explanation: string; before: string; after: string; operation: GraphOperation }
export interface GoalProposal { graphId: string; baseRevision: number; baseline: string; changes: GoalChange[]; errors: string[] }
const roles = { 采撷师: 'gatherer', 守卷人: 'guard', 巡书使: 'scout' } as const;
const fields = { 载量: 'cargo', HP: 'hp', 生命: 'hp', 建材: 'materials' } as const;
const operators = { '<': 'lt', '<=': 'lte', '=': 'eq', '>=': 'gte', '>': 'gt' } as const;
const fingerprint = (graph: RuleGraph) => JSON.stringify(graph);
const display = (value: unknown) => JSON.stringify(value);
function reachesModule(graph: RuleGraph, stateId: string, kind: 'haul' | 'retreat', role: RuleGraph['roles'][number]['role'], threshold: number): boolean {
  const state = graph.states.find(state => state.id === stateId), pending = state ? [state.treeId] : [], visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = graph.nodes.find(node => node.id === id);
    if (!node) continue;
    if (node.type === 'module' && graph.modules.some(module => module.moduleId === node.moduleId && module.kind === kind && module.enabled && (!module.roleFilter || module.roleFilter.includes(role)) && (module.kind === 'haul' ? module.config.minCargo <= threshold : module.kind === 'retreat' && module.config.hpThreshold >= threshold))) return true;
    if (node.type === 'condition') pending.push(node.yes, node.no);
    else if (node.type === 'priority' || node.type === 'sequence') pending.push(...node.children, node.fallback);
    else if (node.type === 'score') pending.push(...node.candidates.map(candidate => candidate.nodeId), node.fallback);
    else if (node.type === 'log') pending.push(node.next);
    else if (node.type === 'module') pending.push(node.fallback);
  }
  return false;
}

export function proposeGoals(graph: RuleGraph, text: string): GoalProposal {
  const proposal: GoalProposal = { graphId: graph.graphId, baseRevision: graph.revision, baseline: fingerprint(graph), changes: [], errors: [] };
  const add = (objectId: string, before: unknown, after: unknown, operation: GraphOperation, explanation: string) => {
    if (display(before) === display(after)) return;
    if (proposal.changes.some(change => change.objectId === objectId)) throw new Error(`对象 ${objectId} 在本次目标中重复修改，请分次比较`);
    proposal.changes.push({ id: `change-${proposal.changes.length + 1}`, objectId, before: display(before), after: display(after), operation, explanation });
  };
  const setCondition = (id: string, condition: GraphCondition) => {
    const node = graph.nodes.find(node => node.id === id);
    const transition = graph.transitions.find(transition => transition.id === id);
    if (node?.type === 'condition') add(id, node.condition, condition, { type: 'putNode', node: { ...node, condition } }, '修改条件判断；不自动发布或改变当前运行版本');
    else if (transition) add(id, transition.condition, condition, { type: 'putTransition', transition: { ...transition, condition } }, '修改跨 tick 转移门槛；优先级和冷却保持原值');
    else throw new Error(`找不到条件节点或转移 ${id}`);
  };
  for (const [index, line] of text.split(/\n|；/).map(line => line.trim()).filter(Boolean).entries()) {
    const start = proposal.changes.length;
    try {
      let match: RegExpMatchArray | null;
      if ((match = line.match(/^(采撷师|守卷人|巡书使)(?:载量到(\d+)就回仓|生命低于(\d+)撤退)$/))) {
        const roleName = match[1] as keyof typeof roles;
        const role = graph.roles.find(role => role.role === roles[roleName]);
        if (!role) throw new Error(`图中没有${match[1]}岗位入口`);
        const state = graph.states.find(state => state.id === role.initialStateId);
        if (!state) throw new Error(`岗位入口状态 ${role.initialStateId} 不存在`);
        const field = match[2] ? 'cargo' : 'hp', value = Number(match[2] ?? match[3]);
        if (!Number.isSafeInteger(value)) throw new Error('阈值须为安全范围内的非负整数');
        if (field === 'hp' && value > 100) throw new Error('生命阈值须为0–100');
        const candidates = graph.transitions.filter(transition => transition.from === state.id && reachesModule(graph, transition.to, field === 'cargo' ? 'haul' : 'retreat', role.role, value) && transition.condition.type === 'compare' && transition.condition.field === field && (field === 'cargo' ? ['gte', 'gt'].includes(transition.condition.op) : ['lt', 'lte'].includes(transition.condition.op)));
        if (candidates.length !== 1) throw new Error(`岗位入口 ${state.id} 对应的${field === 'cargo' ? '返程' : '低血'}转移有 ${candidates.length} 条，请检查目标模块的启用、岗位及阈值，再使用带稳定ID的语法`);
        const transition = candidates[0];
        if (transition.condition.type !== 'compare') throw new Error('转移不是数值条件');
        setCondition(transition.id, { ...transition.condition, value, op: field === 'cargo' ? 'gte' : 'lt' });
        const node = graph.nodes.find(node => node.id === state.treeId);
        if (field === 'cargo' && node?.type === 'condition' && node.condition.type === 'compare' && node.condition.field === 'cargo') {
          const yes = graph.nodes.find(item => item.id === node.yes), no = graph.nodes.find(item => item.id === node.no);
          const directModule = (target: typeof yes, kind: 'haul' | 'gather') => target?.type === 'module' && graph.modules.some(module => module.moduleId === target.moduleId && module.kind === kind && module.enabled && (!module.roleFilter || module.roleFilter.includes(role.role)) && (module.kind !== 'haul' || module.config.minCargo <= value));
          if (['gte', 'gt'].includes(node.condition.op) && directModule(yes, 'haul') && directModule(no, 'gather')) setCondition(node.id, { ...node.condition, value, op: 'gte' });
          else proposal.errors.push(`入口条件 ${node.id} 的真假出口方向无法直接证明，节点未修改；请用稳定ID语法明确修改`);
        }
      } else if ((match = line.match(/^(?:条件|转移) ([\w-]+)[：:]\s*(载量|HP|生命|建材)\s*(<=|>=|<|>|=)\s*(\d+)$/))) {
        const [, id, field, op, number] = match, value = Number(number);
        if (!Number.isSafeInteger(value)) throw new Error('阈值须为安全范围内的非负整数');
        if ((field === 'HP' || field === '生命') && value > 100) throw new Error('生命阈值须为0–100');
        const current = graph.nodes.find(node => node.id === id);
        const condition = current?.type === 'condition' ? current.condition : graph.transitions.find(transition => transition.id === id)?.condition;
        if (condition?.type !== 'compare') throw new Error(`${id} 不是可修改的单值比较条件`);
        setCondition(id, { ...condition, field: fields[field as keyof typeof fields], op: operators[op as keyof typeof operators], value });
      } else if ((match = line.match(/^连接 ([\w-]+)[：:]\s*是→([\w-]+)[，,]\s*否→([\w-]+)$/))) {
        const [, id, yes, no] = match, node = graph.nodes.find(node => node.id === id);
        if (node?.type !== 'condition') throw new Error(`${id} 不是条件节点`);
        if (![yes, no].every(id => graph.nodes.some(node => node.id === id))) throw new Error('连接目标节点不存在');
        add(id, { yes: node.yes, no: node.no }, { yes, no }, { type: 'putNode', node: { ...node, yes, no } }, '修改条件的真实出口；采纳前由图诊断检查环与引用');
      } else if ((match = line.match(/^模块 ([\w-]+)[：:]\s*岗位=(采撷师|守卷人|巡书使)(?:[，,]\s*目标=([\w-]+))?$/))) {
        const [, id, roleName, roomId] = match, module = graph.modules.find(module => module.moduleId === id);
        if (!module) throw new Error(`模块 ${id} 不存在`);
        const updated = { ...module, roleFilter: [roles[roleName as keyof typeof roles]] };
        if (roomId) {
          if (updated.kind === 'gather') updated.config = { ...updated.config, targetRoomId: roomId };
          else if (updated.kind === 'build' || updated.kind === 'defend') updated.config = { ...updated.config, roomId };
          else throw new Error(`模块 ${id} 不支持指定目标房间`);
        }
        add(id, module, updated, { type: 'putModule', module: updated }, '修改共享模块的岗位/目标；所有引用该模块的节点都会受影响');
      } else throw new Error('未识别。请使用下方明确支持的中文语法');
    } catch (error) {
      proposal.changes.splice(start);
      proposal.errors.push(`第${index + 1}项：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return proposal;
}

export function selectedGoalPatch(graph: RuleGraph, proposal: GoalProposal, ids: string[]): GraphPatch {
  if (graph.graphId !== proposal.graphId || graph.revision !== proposal.baseRevision || fingerprint(graph) !== proposal.baseline) throw new Error('图已变化，目标基线过期，请重新生成差异');
  const selected = new Set(ids);
  if ([...selected].some(id => !proposal.changes.some(change => change.id === id))) throw new Error('所选差异不存在');
  const operations = proposal.changes.filter(change => selected.has(change.id)).map(change => change.operation);
  if (!operations.length) throw new Error('请至少选择一项差异');
  return { graphId: graph.graphId, baseRevision: graph.revision, operations };
}

export function inverseGoalPatch(before: RuleGraph, after: RuleGraph, patch: GraphPatch): GraphPatch {
  const operations: GraphOperation[] = patch.operations.map(operation => {
    if (operation.type === 'putNode') return { type: 'putNode', node: before.nodes.find(node => node.id === operation.node.id)! };
    if (operation.type === 'putTransition') return { type: 'putTransition', transition: before.transitions.find(transition => transition.id === operation.transition.id)! };
    if (operation.type === 'putModule') return { type: 'putModule', module: before.modules.find(module => module.moduleId === operation.module.moduleId)! };
    throw new Error('目标撤销只接受本面板提出的已有对象修改');
  });
  return { graphId: after.graphId, baseRevision: after.revision, operations };
}
export { applyGraphPatch };
