import { createFirstExpeditionPlan } from '../defaults';
import type { BehaviorPlan } from '../types';
import type { RuleGraph, GraphCondition } from './types';
export const cargoThreshold = (value: number): GraphCondition => ({ type: 'compare', field: 'cargo', op: 'gte', value, missing: false });
export function createLogisticsGraph(): RuleGraph {
  return {
    schemaVersion: 2, graphId: 'logistics-graph', revision: 0,
    roles: [
      { id: 'role-gatherer', role: 'gatherer', initialStateId: 'working', fallbackStateId: 'working' },
      { id: 'role-guard', role: 'guard', initialStateId: 'guarding', fallbackStateId: 'guarding' },
      { id: 'role-scout', role: 'scout', initialStateId: 'building', fallbackStateId: 'building' },
    ],
    states: [
      { id: 'working', name: '作业', treeId: 'cargo-check', entry: [{ type: 'remember', key: 'phase', value: 'work' }], exit: [{ type: 'reason', reason: 'leaving work' }] },
      { id: 'returning', name: '返程', treeId: 'haul-node', entry: [{ type: 'remember', key: 'phase', value: 'return' }], exit: [] },
      { id: 'guarding', name: '清守', treeId: 'defend-node', entry: [], exit: [] },
      { id: 'building', name: '建造与编目', treeId: 'build-first', entry: [], exit: [] },
    ],
    transitions: [
      { id: 'start-return', from: 'working', to: 'returning', priority: 10, condition: cargoThreshold(8), cooldownTicks: 0, minStateTicks: 0 },
      { id: 'resume-work', from: 'returning', to: 'working', priority: 10, condition: { type: 'compare', field: 'cargo', op: 'eq', value: 0, missing: false }, cooldownTicks: 0, minStateTicks: 1 },
    ],
    nodes: [
      { id: 'cargo-check', type: 'condition', condition: cargoThreshold(8), yes: 'haul-node', no: 'gather-node' },
      { id: 'gather-node', type: 'module', moduleId: 'gather', fallback: 'hold-node' },
      { id: 'haul-node', type: 'module', moduleId: 'haul', fallback: 'hold-node' },
      { id: 'defend-node', type: 'module', moduleId: 'defend', fallback: 'hold-node' },
      { id: 'build-node', type: 'module', moduleId: 'build', fallback: 'pass-node' },
      { id: 'build-first', type: 'priority', children: ['build-node', 'defend-node'], fallback: 'hold-node' },
      { id: 'pass-node', type: 'pass', reason: 'candidate unavailable' },
      { id: 'hold-node', type: 'hold', reason: 'no applicable action' },
    ], modules: createFirstExpeditionPlan().modules.map(module=>module.kind==='haul' ? { ...module, config: {minCargo:1} } : module),
  };
}
export function createRetreatGraph(): RuleGraph {
  const graph=createLogisticsGraph(); graph.graphId='retreat-cooldown-graph';
  for (const from of ['working','returning','guarding','building']) {
    const recovery='recovering-'+from;
    graph.states.push({id:recovery,name:'撤退恢复',treeId:'retreat-node',entry:[{type:'remember',key:'retreats',value:true}],exit:[{type:'reason',reason:'health recovered'}]});
    graph.transitions.push({id:'low-hp-'+from,from,to:recovery,priority:100,condition:{type:'compare',field:'hp',op:'lte',value:20,missing:true},cooldownTicks:8,minStateTicks:0});
    graph.transitions.push({id:'recovered-'+from,from:recovery,to:from,priority:10,condition:{type:'compare',field:'hp',op:'gte',value:60,missing:false},cooldownTicks:8,minStateTicks:4});
  }
  graph.nodes.push({id:'retreat-node',type:'module',moduleId:'retreat',fallback:'hold-node'});
  const retreat=graph.modules.find(m=>m.kind==='retreat')!; if(retreat.kind==='retreat')retreat.config.hpThreshold=60;
  return graph;
}
/** Explicit conversion; callers keep the original project in existing undo history. */
export function fromBehaviorPlan(plan: BehaviorPlan): RuleGraph {
 const modules=structuredClone(plan.modules);
 const sorted=modules.map((module,index)=>({module,index})).sort((a,b)=>b.module.priority-a.module.priority||a.index-b.index);
 return {schemaVersion:2,graphId:plan.compositionId+'-graph',revision:0,modules,
  roles:['gatherer','guard','scout'].map(role=>({id:'graph-role-'+role,role:role as 'gatherer'|'guard'|'scout',initialStateId:'graph-state-'+role,fallbackStateId:'graph-state-'+role})),
  states:['gatherer','guard','scout'].map(role=>({id:'graph-state-'+role,name:role,treeId:sorted.length?'graph-module-0':'graph-hold',entry:[],exit:[]})),transitions:[],
  nodes:[...sorted.map(({module},index)=>({id:'graph-module-'+index,type:'module' as const,moduleId:module.moduleId,fallback:index+1<sorted.length?'graph-module-'+(index+1):'graph-hold'})),{id:'graph-hold',type:'hold',reason:'no applicable module'}],
 };
}
