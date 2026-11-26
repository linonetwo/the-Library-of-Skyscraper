import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
test('stdio visible custom author compiles, saves and connects a named exit',{
 skip:process.env.ARENA_CUSTOM_MODULE_BROWSER!=='1',timeout:120000,
},async t=>{
 const {Client}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
 const {StdioClientTransport}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
 const client=new Client({name:'custom-module-browser',version:'1'}),steps=[];
 const out=process.env.ARENA_EVIDENCE_DIR;
 if(out)await mkdir(out,{recursive:true});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:process.env,stderr:'pipe'}));
 const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});steps.push({name,args,result:r});assert(!r.isError,r.content[0]?.text);return JSON.parse(r.content[0].text);};
 const action=action=>call('Input.action',{action}),state=()=>call('Page.getState');
 t.after(async()=>{
  if(out){const r=await client.callTool({name:'Page.captureScreenshot',arguments:{}}).catch(()=>null);if(r?.content[0]?.type==='image')await writeFile(`${out}/author.png`,Buffer.from(r.content[0].data,'base64'));await writeFile(`${out}/report.json`,JSON.stringify({completed:completed,steps},null,2));}
  await client.callTool({name:'Page.close',arguments:{}}).catch(()=>{});await client.close();
 });
 let completed=false;
 await call('Page.open');await action({type:'startTraining'});await action({type:'openRuleGraph'});await action({type:'convertBehaviorToRuleGraph'});await action({type:'loadRuleGraphTemplate',template:'logistics'});
 const initialGraph=(await state()).graph.graph;
 await action({type:'createCustomModule'});
 await action({type:'setCustomModuleField',label:'自定义模块名称',value:'MCP货袋'});
 await action({type:'setCustomModuleField',label:'参数 1 默认值',value:6});
 await action({type:'setCustomModuleField',label:'出口 1 显示名',value:'MCP满载'});
 const source="import type {Input,Result} from './types';\nexport function decide(input:Input):Result {\n if(input.actor.cargo>=input.params.limit)return {type:'exit',key:'bagFull',reason:'MCP货量阈值'};\n return {type:'fallback',reason:'MCP后备'};\n}\n";
 await action({type:'editCustomModuleSource',source});await action({type:'compileCustomModule'});
 let s;for(let i=0;i<30;i++){s=await state();if(s.customModules.author.text.includes('模块编译通过'))break;await new Promise(r=>setTimeout(r,100));}
 assert(s.customModules.author.text.includes('模块编译通过'),s.customModules.author.text);
 await action({type:'saveCustomModule'});await action({type:'returnCustomModuleLibrary'});s=await state();
 const button=s.customModules.library.buttons.find(b=>b.label.startsWith('添加自定义模块 MCP货袋 '));assert(button);
 const revisionPrefix=button.label.split(' ').at(-1);
 await action({type:'useCustomModuleLibraryItem',operation:'add',name:'MCP货袋',revisionPrefix});
 await action({type:'setRuleModuleTarget',stateId:initialGraph.states[0].id});await action({type:'confirmRuleModule'});
 s=await state();const module=s.graph.graph.modules.find(m=>m.kind==='custom');assert(module);assert.equal(module.config.limit,6);
 const node=s.graph.graph.nodes.find(n=>n.type==='module'&&n.moduleId===module.moduleId);assert(node);
 await action({type:'selectRuleGraphObject',kind:'nodes',id:node.id});
 const target=s.graph.graph.nodes.find(n=>n.type==='module'&&n.moduleId!==module.moduleId);assert(target);
 await action({type:'connectRuleGraph',port:'MCP满载 · bagFull',target:target.id});s=await state();
 assert.equal(s.graph.graph.nodes.find(n=>n.id===node.id).exits.bagFull,target.id);
 completed=true;
});
