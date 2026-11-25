import { createLogisticsGraph } from './examples';
import type { RuleGraph } from './types';
/** Explicit special edges; work/deposit/guard still use the original official modules. */
export function createShortcutSupportGraph(): RuleGraph {
 const graph=createLogisticsGraph();graph.graphId='shortcut-support-graph';
 const gather=graph.modules.find(module=>module.kind==='gather');if(gather?.kind==='gather')gather.config.targetRoomId='room-2';
 graph.nodes.push(
  {id:'jump-from-resource',type:'condition',condition:{type:'atRoom',roomId:'room-1',missing:false},yes:'jump-to-stacks',no:'gather-node'},
  {id:'jump-to-stacks',type:'mobility',action:{type:'jump',edgeId:'jump-room-1-room-2'},priority:40,fallback:'gather-node'},
  {id:'run-support-check',type:'condition',condition:{type:'atRoom',roomId:'room-1',missing:false},yes:'run-support',no:'defend-node'},
  {id:'run-support',type:'mobility',action:{type:'run',viaRoomId:'room-0',roomId:'room-3'},priority:50,fallback:'defend-node'},
  {id:'climb-support-check',type:'condition',condition:{type:'atRoom',roomId:'room-4',missing:false},yes:'climb-support',no:'build-first'},
  {id:'climb-support',type:'mobility',action:{type:'climb',edgeId:'climb-room-4-room-3'},priority:50,fallback:'build-first'},
 );
 const cargo=graph.nodes.find(node=>node.id==='cargo-check');if(cargo?.type==='condition')cargo.no='jump-from-resource';
 graph.states.find(state=>state.id==='guarding')!.treeId='run-support-check';
 graph.states.find(state=>state.id==='building')!.treeId='climb-support-check';
 return graph;
}
