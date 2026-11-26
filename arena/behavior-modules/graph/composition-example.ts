import {createRetreatGraph} from './examples';
import type {RuleGraph} from './types';
/** Existing logistics/build/retreat stay available; new work is explicit role composition. */
export function createCompositionGraph():RuleGraph {
 const graph=createRetreatGraph();graph.graphId='scout-patrol-escort';
 graph.modules.push(
  {moduleId:'scout-catalog',kind:'scout',enabled:true,priority:30,config:{target:{type:'room',roomId:'room-3'},maxEnemyHp:0,reportIntervalTicks:8}},
  {moduleId:'patrol-resource',kind:'patrol',enabled:true,priority:20,config:{rooms:[{type:'room',roomId:'room-0'},{type:'room',roomId:'room-1'}],dwellTicks:2}},
  {moduleId:'escort-cargo',kind:'escort',enabled:true,priority:30,config:{target:{type:'ownRole',role:'gatherer'},minCargo:8}},
 );
 graph.nodes.push(
  {id:'scout-and-patrol',type:'priority',children:['build-node','scout-catalog-node','patrol-resource-node'],fallback:'build-first'},
  {id:'scout-catalog-node',type:'module',moduleId:'scout-catalog',fallback:'pass-node'},
  {id:'patrol-resource-node',type:'module',moduleId:'patrol-resource',fallback:'pass-node'},
  {id:'escort-cargo-node',type:'module',moduleId:'escort-cargo',fallback:'defend-node'},
 );
 graph.states.find(s=>s.id==='building')!.treeId='scout-and-patrol';
 graph.states.find(s=>s.id==='guarding')!.treeId='escort-cargo-node';
 return graph;
}
