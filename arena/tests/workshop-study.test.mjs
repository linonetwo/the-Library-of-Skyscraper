import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from '../tools/node_modules/zod/index.js';
import {workshopActionSchemas} from '../tools/browser-workshop.mjs';
const actions=z.discriminatedUnion('type',workshopActionSchemas);
test('workshop study preserves the default action and accepts the actual study route',()=>{
 assert.deepEqual(actions.parse({type:'openWorkshop'}),{type:'openWorkshop'});
 assert.deepEqual(actions.parse({type:'openWorkshop',study:'cast-recover'}),{type:'openWorkshop',study:'cast-recover'});
 assert.equal(actions.safeParse({type:'openWorkshop',study:'arbitrary-route'}).success,false);
 assert.equal(actions.safeParse({type:'openWorkshop',url:'https://example.com'}).success,false);
});
test('real stdio study exposes clip choices and reuses pause/frame controls',{
 skip:process.env.ARENA_WORKSHOP_STUDY!=='1',timeout:60000,
},async t=>{
 const {Client}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
 const {StdioClientTransport}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
 const {fileURLToPath}=await import('node:url');
 const client=new Client({name:'workshop-study',version:'1'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:process.env,stderr:'pipe'}));
 t.after(async()=>{await client.callTool({name:'Page.close',arguments:{}}).catch(()=>{});await client.close();});
 const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,r.content[0]?.text);return JSON.parse(r.content[0].text);},action=action=>call('Input.action',{action});
 await call('Page.open');await action({type:'openWorkshop',study:'cast-recover'});await action({type:'pauseWorkshop'});
 for(const clip of ['cast','recover']){
  await action({type:'setWorkshopAction',action:clip});const before=(await call('Page.getState')).workshop;
  assert.equal(before.study,'cast-recover');assert.equal(before.action,clip);
  assert(before.actionChoices.some(option=>option.value===clip&&!option.disabled));
  await action({type:'stepWorkshop'});const after=(await call('Page.getState')).workshop;
  assert.equal(after.frame,(before.frame+1)%before.frameCount);assert.equal(after.playing,false);assert.equal(after.error,null);
 }
 await action({type:'openWorkshop'});assert.equal((await call('Page.getState')).workshop.study,null);
});
