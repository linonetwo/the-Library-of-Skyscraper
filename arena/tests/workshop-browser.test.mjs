import test from 'node:test';
import assert from 'node:assert/strict';
test('MCP browser controls workshop through real visible inputs', {skip:process.env.ARENA_BROWSER!=='1',timeout:90000}, async t=>{
 const { Client }=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
 const { StdioClientTransport }=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
 const {fileURLToPath}=await import('node:url');
 const client=new Client({name:'replay-browser',version:'1'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:process.env,stderr:'pipe'}));
 t.after(()=>client.close());
 const call=async(name,args={})=>{const response=await client.callTool({name,arguments:args});assert.notEqual(response.isError,true,response.content[0].text);return JSON.parse(response.content[0].text);};
 const action=action=>call('Input.action',{action});
 await call('Page.open');
 t.after(async()=>{try{await call('Page.close');}catch{}});
 await action({type:'openWorkshop'});
 await action({type:'setWorkshopAction',action:'idle'});
 await action({type:'setWorkshopAction',action:'idle'});
 await action({type:'pauseWorkshop'});
 await action({type:'pauseWorkshop'});
 await action({type:'setWorkshopAction',action:'walk'});
 await action({type:'setWorkshopAction',action:'walk'});
 await action({type:'selectWorkshopDirection',direction:'SE'});
 const before=(await call('Page.getState')).workshop.frame;
 await action({type:'stepWorkshop'});
 await action({type:'setWorkshopFps',fps:12});
 await action({type:'setWorkshopOutfit',outfit:'warden'});
 await action({type:'setWorkshopHair',hair:'midnight'});
 for(const layer of ['outfit','hair','weapon']) await action({type:'setWorkshopLayer',layer,visible:false});
 const state=(await call('Page.getState')).workshop;
 assert.equal(state.frame,(before+1)%4);
 assert.equal(state.direction,'SE');
 assert.equal(state.playing,false);
 assert.equal(state.fps,12);
 assert.deepEqual(state.appearance,{outfit:'warden',hair:'midnight',weapon:false});
 assert.deepEqual(state.layers,{outfit:false,hair:false});
 for(const layer of ['outfit','hair','weapon']) await action({type:'setWorkshopLayer',layer,visible:true});
 const shot=await client.callTool({name:'Page.captureScreenshot',arguments:{}});
 assert.equal(shot.content[0].mimeType,'image/png');
 if(process.env.WORKSHOP_CAPTURE) {
  const {writeFile}=await import('node:fs/promises');
  await writeFile(process.env.WORKSHOP_CAPTURE,Buffer.from(shot.content[0].data,'base64'));
 }
 await action({type:'returnToArena'});
 assert.equal((await call('Page.getState')).workshop,null);
});

test('workshop state remains readable while atlases load or fail', {skip:process.env.ARENA_BROWSER!=='1'}, async t=>{
 const {chromium}=await import('../tools/node_modules/playwright/index.mjs');
 const {readWorkshopState}=await import('../tools/browser-workshop.mjs');
 const browser=await chromium.launch(); t.after(()=>browser.close());
 const page=await browser.newPage();
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 await page.route('**/assets/animation/idle-*.json',async route=>{
  await pending; await route.fulfill({status:503,body:'unavailable'});
 });
 await page.goto('http://127.0.0.1:5173/animation-lab');
 const loading=await readWorkshopState(page);
 assert.equal(loading.loading,true); assert.equal(loading.direction,null);
 release(); await page.getByRole('alert').waitFor();
 const failed=await readWorkshopState(page);
 assert.match(failed.error,/503/); assert.equal(failed.loading,false); assert.equal(failed.direction,null);
});
