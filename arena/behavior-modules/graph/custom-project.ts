import type { CustomModuleDefinition } from './custom-types';
import type { RuleGraph, GraphSourceRef } from './types';
import type { RuleSourceProject } from '../types';
import { customDefinitionFiles, customDefinitionKey } from './custom-source';
import { customRuntimeSource } from './custom-runtime';
export function referencedCustomDefinitions(graph:RuleGraph):CustomModuleDefinition[] {
 const keys=new Set(graph.modules.flatMap(m=>m.kind==='custom'?[customDefinitionKey(m)]:[]));
 return (graph.customDefinitions??[]).filter(d=>keys.has(customDefinitionKey(d)));
}
/** Static imports, one outer decide: no eval, fetching or mutable library lookup. */
export function customProjectFiles(graph:RuleGraph):Record<string,string> {
 const files:Record<string,string>={'custom-runtime.ts':customRuntimeSource};
 const imports:string[]=[],entries:string[]=[];
 referencedCustomDefinitions(graph).forEach((definition,index)=>{
  Object.assign(files,customDefinitionFiles(definition,definition.revisionId).files);
  imports.push(`import {decide as body${index}} from './custom/${definition.revisionId}/body';`);
  entries.push(`${JSON.stringify(customDefinitionKey(definition))}:(input)=>body${index}(input as Parameters<typeof body${index}>[0])`);
 });
 files['custom-registry.ts']="import type {CustomModuleInput,CustomModuleResult} from '@skyscraper/arena-script-sdk';\nimport type {CustomParameter} from './graph-plan';\n"+imports.join('\n')+`\nexport const customBodies:Record<string,(input:CustomModuleInput<Record<string,CustomParameter>>)=>CustomModuleResult<string>>={\n${entries.join(',\n')}\n};\n`;
 return files;
}
/** Caller supplies the archived declaration reader, never current-generator recovery. */
export function archivedCustomBodyRef(project:RuleSourceProject,graph:RuleGraph,moduleId:string):GraphSourceRef|null {
 const module=graph.modules.find(m=>m.moduleId===moduleId);if(module?.kind!=='custom')return null;
 const definition=graph.customDefinitions?.find(d=>customDefinitionKey(d)===customDefinitionKey(module));if(!definition)return null;
 const file=`custom/${definition.revisionId}/body.ts`,source=project.files[file];
 if(source!==definition.source)return null;
 const line=source.split('\n').findIndex(line=>/^\s*export\s+(?:async\s+)?function\s+decide\s*\(/.test(line));
 return line<0?null:{file,line:line+1,column:1};
}
export const customContractSource=`export type CustomParameter=number|boolean|RoomRef|OwnRoleRef;
export interface CustomModuleBinding {moduleId:string;kind:'custom';definitionId:string;revisionId:string;config:Record<string,CustomParameter>;enabled:boolean;priority:number;roleFilter?:ActorRole[]}
export interface CustomModuleDefinition {definitionId:string;revisionId:string;name:string;fields:unknown[];exits:{key:string;label:string}[];source:string}
`;
export function addCustomContract(source:string):string {
 return customContractSource+source
 .replace('BehaviorModule | CompositionModule;','BehaviorModule | CompositionModule | CustomModuleBinding;')
 .replace("'escort-defending';","'escort-defending' | 'custom-selected' | 'custom-hold' | 'custom-fallback' | 'custom-exit' | 'custom-unconnected-exit';")
 .replace('  fallbackNodeId?: string;','  fallbackNodeId?: string; exitKey?:string; reason?:string;')
 .replace("moduleId: string; fallback: string }","moduleId: string; fallback: string; exits?:Record<string,string> }")
 .replace('nodes: RuleNode[]; modules: GraphModule[];','nodes: RuleNode[]; modules: GraphModule[]; customDefinitions?:CustomModuleDefinition[];');
}
