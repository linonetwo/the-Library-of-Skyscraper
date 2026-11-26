import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
test('visible module previews cancel cleanly, shared references stay shared and copying rebinds one selected leaf',{
 skip:process.env.ARENA_COMPOSITION_BROWSER!=='1',timeout:120000,
},async t=>{
 const {Client}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
 const {StdioClientTransport}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
 const client=new Client({name:'composition-controls-browser',version:'1'});await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:process.env,stderr:'pipe'}));
 t.after(async()=>{await client.callTool({name:'Page.close',arguments:{}}).catch(()=>{});await client.close();});
 const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,r.content[0]?.text);return JSON.parse(r.content[0].text);},action=action=>call('Input.action',{action}),state=()=>call('Page.getState');
 await call('Page.open');await action({type:'startTraining'});await action({type:'openRuleGraph'});await action({type:'convertBehaviorToRuleGraph'});await action({type:'loadRuleGraphTemplate',template:'logistics'});
 const before=(await state()).graph.graph;
 for(const kind of ['scout','patrol','escort','gather','haul','build','defend','retreat']){
  await action({type:'previewRuleModule',kind});assert((await state()).composition.preview);assert.deepEqual((await state()).graph.graph,before);await action({type:'cancelRuleModulePreview'});assert.deepEqual((await state()).graph.graph,before);
 }
 await action({type:'previewRuleModule',kind:'patrol'});await action({type:'setRuleGraphField',scope:'modulePreview',label:'巡逻站点 1',value:'room-0'});await action({type:'setRuleGraphField',scope:'modulePreview',label:'驻留拍数',value:2});await action({type:'setRuleModuleTarget',stateId:before.states[0].id});await action({type:'confirmRuleModule'});
 const first=(await state()).graph.graph,module=first.modules.find(m=>!before.modules.some(old=>old.moduleId===m.moduleId));assert.equal(module.kind,'patrol');assert.equal(module.config.dwellTicks,2);
 await action({type:'previewSharedRuleModule',moduleId:module.moduleId});await action({type:'setRuleModuleTarget',stateId:before.states[1].id});await action({type:'confirmRuleModule'});
 const shared=(await state()).graph.graph,refs=shared.nodes.filter(n=>n.type==='module'&&n.moduleId===module.moduleId);assert.equal(refs.length,2);assert.equal(shared.modules.length,first.modules.length);
 await action({type:'selectRuleGraphObject',kind:'modules',id:module.moduleId});await action({type:'selectRuleModuleCopyReference',nodeId:refs[0].id,selected:true});await action({type:'copyRuleModuleInstance'});
 const copied=(await state()).graph.graph;assert.equal(copied.modules.length,shared.modules.length+1);assert.notEqual(copied.nodes.find(n=>n.id===refs[0].id).moduleId,module.moduleId);assert.equal(copied.nodes.find(n=>n.id===refs[1].id).moduleId,module.moduleId);
 await action({type:'undoRuleGraph'});assert.deepEqual((await state()).graph.graph,shared);
});
