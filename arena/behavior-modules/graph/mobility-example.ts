import { createLogisticsGraph } from './examples';
import type { RuleGraph } from './types';
/** Approach uses original move-producing modules; only explicit leaves take special routes. */
export function createShortcutSupportGraph(): RuleGraph {
 const graph=createLogisticsGraph();graph.graphId='shortcut-support-graph';
 const at=(roomId:string)=>({type:'atRoom' as const,roomId,missing:false});
 graph.modules.push(
  {moduleId:'approach-bridge',kind:'defend',enabled:true,priority:10,roleFilter:['gatherer'],config:{roomId:'room-2'}},
  {moduleId:'approach-east',kind:'defend',enabled:true,priority:10,roleFilter:['guard'],config:{roomId:'room-1'}},
  {moduleId:'approach-west',kind:'defend',enabled:true,priority:10,roleFilter:['scout'],config:{roomId:'room-4'}},
 );
 graph.nodes.push(
  {id:'approach-bridge-node',type:'module',moduleId:'approach-bridge',fallback:'hold-node'},
  {id:'approach-east-node',type:'module',moduleId:'approach-east',fallback:'hold-node'},
  {id:'approach-west-node',type:'module',moduleId:'approach-west',fallback:'hold-node'},
  {id:'bridge-work-check',type:'condition',condition:at('room-1'),yes:'gather-node',no:'jump-from-resource'},
  {id:'jump-from-resource',type:'condition',condition:at('room-2'),yes:'jump-to-stacks',no:'approach-bridge-node'},
  {id:'jump-to-stacks',type:'mobility',action:{type:'jump',edgeId:'jump-room-1-room-2'},priority:40,fallback:'gather-node'},
  {id:'run-arrived-check',type:'condition',condition:at('room-3'),yes:'defend-node',no:'run-support-check'},
  {id:'run-support-check',type:'condition',condition:at('room-1'),yes:'run-support',no:'approach-east-node'},
  {id:'run-support',type:'mobility',action:{type:'run',viaRoomId:'room-0',roomId:'room-3'},priority:50,fallback:'defend-node'},
  {id:'climb-arrived-check',type:'condition',condition:at('room-3'),yes:'build-first',no:'climb-support-check'},
  {id:'climb-support-check',type:'condition',condition:at('room-4'),yes:'climb-support',no:'approach-west-node'},
  {id:'climb-support',type:'mobility',action:{type:'climb',edgeId:'climb-room-4-room-3'},priority:50,fallback:'build-first'},
 );
 const cargo=graph.nodes.find(node=>node.id==='cargo-check');if(cargo?.type==='condition')cargo.no='bridge-work-check';
 graph.states.find(state=>state.id==='guarding')!.treeId='run-arrived-check';
 graph.states.find(state=>state.id==='building')!.treeId='climb-arrived-check';
 return graph;
}
