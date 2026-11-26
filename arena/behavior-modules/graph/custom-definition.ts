import { canonical } from './source';
import type { CustomField, CustomModuleDraft, CustomModuleDefinition, CustomModuleDiagnostic, CustomParameter } from './custom-types';
const identifier=/^[A-Za-z_$][\w$]*$/;
export function customParameterMatches(field:CustomField,value:unknown):boolean {
  switch(field.type){
    case 'number':return typeof value==='number'&&Number.isFinite(value)&&(!field.integer||Number.isInteger(value))&&(field.min===undefined||value>=field.min)&&(field.max===undefined||value<=field.max);
    case 'boolean':return typeof value==='boolean';
    case 'roomRef':return !!value&&typeof value==='object'&&'type' in value&&value.type==='room'&&'roomId' in value&&typeof value.roomId==='string'&&!!value.roomId;
    case 'ownRoleRef':return !!value&&typeof value==='object'&&'type' in value&&value.type==='ownRole'&&'role' in value&&['gatherer','guard','scout'].includes(value.role as string);
  }
}
export function diagnoseCustomModule(draft:CustomModuleDraft,config?:Record<string,CustomParameter>):CustomModuleDiagnostic[] {
  const result:CustomModuleDiagnostic[]=[];
  const add=(code:string,message:string,key?:string)=>result.push({code,message,...(key===undefined?{}:{key})});
  if(!draft.definitionId.trim())add('definition-id','A definition needs a stable ID');
  if(!draft.name.trim())add('name','Name the module');
  if(!draft.source.trim())add('source','Provide the module TypeScript body');
  const fields=new Set<string>(),exits=new Set<string>();
  for(const field of draft.fields){
    if(!identifier.test(field.key)||fields.has(field.key))add('field-key','Field keys must be unique TypeScript identifiers',field.key);
    fields.add(field.key);
    if(field.type==='number'&&((field.min!==undefined&&!Number.isFinite(field.min))||(field.max!==undefined&&!Number.isFinite(field.max))||(field.min!==undefined&&field.max!==undefined&&field.min>field.max)))add('field-bounds','Invalid numeric bounds',field.key);
    if(!customParameterMatches(field,field.default))add('field-default','Default does not match its field',field.key);
    if(config&&!customParameterMatches(field,config[field.key]))add('parameter','Required parameter does not match its field',field.key);
  }
  for(const exit of draft.exits){if(!identifier.test(exit.key)||exits.has(exit.key))add('exit-key','Exit keys must be unique TypeScript identifiers',exit.key);exits.add(exit.key);}
  if(config)for(const key of Object.keys(config))if(!fields.has(key))add('parameter-unknown','Parameter is not declared by this version',key);
  return result;
}
/** A new immutable version; library and graph snapshots share this exact text. */
export async function saveCustomModuleDefinition(draft:CustomModuleDraft):Promise<CustomModuleDefinition> {
  const errors=diagnoseCustomModule(draft);if(errors.length)throw new Error(errors.map(d=>d.message).join('\n'));
  const content={name:draft.name,fields:draft.fields,exits:draft.exits,source:draft.source};
  const bytes=new TextEncoder().encode(canonical(content));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  const revisionId=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {...structuredClone(draft),revisionId};
}
export function customModuleDefaults(definition:CustomModuleDraft):Record<string,CustomParameter> {
  return Object.fromEntries(definition.fields.map(field=>[field.key,structuredClone(field.default)]));
}
