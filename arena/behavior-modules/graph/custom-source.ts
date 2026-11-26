import type { CustomModuleDraft, CustomModuleDefinition } from './custom-types';
import type { RuleSourceProject } from '../types';
import { customModuleDefaults } from './custom-definition';
export function createCustomModuleDraft(definitionId:string):CustomModuleDraft {
  return {definitionId,name:'巡库采撷',fields:[{key:'limit',label:'返仓货量',type:'number',default:4,integer:true,min:0},{key:'resourceRoom',label:'采集房间',type:'roomRef',default:{type:'room',roomId:'room-1'}}],exits:[{key:'bagFull',label:'货袋已满'}],source:`import type { Input, Result } from './types';

export function decide(input: Input): Result {
  if (input.actor.cargo >= input.params.limit) return { type: 'exit', key: 'bagFull', reason: '货量达到返仓阈值' };
  if (input.actor.travel) return { type: 'hold', reason: '等待实际抵达' };
  const roomId = input.params.resourceRoom.roomId;
  if (!input.world.rooms.some(room => room.id === roomId)) return { type: 'fallback', reason: '采集房间不可用，走后备' };
  if (input.actor.roomId !== roomId) return { type: 'action', intent: { type: 'move', roomId }, reason: '前往采集房间' };
  return { type: 'action', intent: { type: 'gather' }, reason: '尚未达到返仓阈值，继续采集' };
}
`};
}
export function customDefinitionFiles(definition:CustomModuleDraft,key:string):{files:Record<string,string>;activeFile:string} {
  const directory='custom/'+key,activeFile=directory+'/body.ts';
  const fields=definition.fields.map(field=>JSON.stringify(field.key)+': '+(field.type==='number'?'number':field.type==='boolean'?'boolean':field.type==='roomRef'?'{readonly type:"room";readonly roomId:string}':'{readonly type:"ownRole";readonly role:"gatherer"|"guard"|"scout"}')+';').join('\n');
  const exits=definition.exits.map(exit=>JSON.stringify(exit.key)).join('|')||'never';
  return {activeFile,files:{[activeFile]:definition.source,[directory+'/types.ts']:`import type {CustomModuleInput,CustomModuleResult} from '@skyscraper/arena-script-sdk';\nexport interface Params {\n${fields}\n}\nexport type Input=CustomModuleInput<Params>;\nexport type Result=CustomModuleResult<${exits}>;\n`}};
}
/** The editor shows exactly the body text that will be packed, with its generated types. */
export function customModuleEditorProject(draft:CustomModuleDraft):{project:RuleSourceProject;activeFile:string} {
  const {files,activeFile}=customDefinitionFiles(draft,'draft');
  const main=`import type {RuleContext,RuleDecisionResult} from '@skyscraper/arena-script-sdk';\nimport {decide as body} from './custom/draft/body';\nexport function decide(ctx:RuleContext):RuleDecisionResult {\n const actor=ctx.squad.actors[0];if(!actor)return {intents:[]};\n const result=body({tick:ctx.tick,player:ctx.player,squad:ctx.squad,world:ctx.world,tasks:ctx.tasks,actor,params:${JSON.stringify(customModuleDefaults(draft))},memory:null});\n return {intents:result.type==='action'?[{...result.intent,actorId:actor.id,priority:20}]:[]};\n}\n`;
  return {project:{entry:'main.ts',files:{'main.ts':main,...files}},activeFile};
}
export function customDefinitionKey(definition:Pick<CustomModuleDefinition,'definitionId'|'revisionId'>):string {return JSON.stringify([definition.definitionId,definition.revisionId]);}
