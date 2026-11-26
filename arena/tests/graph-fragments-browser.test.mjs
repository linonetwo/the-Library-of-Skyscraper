import {mkdir,writeFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
test('stdio saves a visible subtree, binds its insertion preview and undoes one confirmed patch',{
 skip:process.env.ARENA_FRAGMENTS_BROWSER!=='1',timeout:120000,
},async t=>{
 const {Client}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
 const {StdioClientTransport}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
 const evidence=process.env.ARENA_EVIDENCE_DIR,report={method:'actual source stdio to visible fragment controls',ui:process.env.ARENA_UI_URL,calls:[]};
 if(evidence){await mkdir(evidence,{recursive:false});t.after(()=>writeFile(evidence+'/report.json',JSON.stringify(report,null,2)));}
 const client=new Client({name:'graph-fragments-browser',version:'1'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:process.env,stderr:'pipe'}));
 t.after(async()=>{await client.callTool({name:'Page.close',arguments:{}}).catch(()=>{});await client.close();});
 const call=async(name,args={})=>{const result=await client.callTool({name,arguments:args});report.calls.push({name,args,isError:!!result.isError,...(result.isError?{error:result.content[0]?.text}:{})});assert(!result.isError,result.content[0]?.text);return JSON.parse(result.content[0].text);};
 const action=action=>call('Input.action',{action}),state=()=>call('Page.getState');
 await call('Page.open');await action({type:'startTraining'});await action({type:'openRuleGraph'});await action({type:'convertBehaviorToRuleGraph'});await action({type:'loadRuleGraphTemplate',template:'logistics'});
 const before=(await state()).graph.graph,target=before.states[0];report.before=before;assert(target.treeId);
 await action({type:'selectRuleGraphObject',kind:'nodes',id:target.treeId});await action({type:'openRuleGraphFragments'});
 const name='MCP复用 '+Date.now();await action({type:'saveRuleGraphFragment',name});
 const saved=(await state()).fragments.saved.find(item=>item.name===name);assert(saved);
 await action({type:'previewRuleGraphFragment',fragmentId:saved.id});await action({type:'setRuleGraphFragmentTarget',stateId:target.id});
 const preview=(await state()).fragments;report.preview=preview;assert.equal(preview.selected.id,saved.id);assert.deepEqual((await state()).graph.graph,before);
 for(const field of preview.controls){const choice=field.options.find(option=>option.value);assert(choice);
  if(field.label?.startsWith('原房间 '))await action({type:'bindRuleGraphFragmentRoom',fromRoomId:field.label.slice('原房间 '.length,-' → 目标房间'.length),roomId:choice.value});
  else if(field.label?.startsWith('岗位绑定 '))await action({type:'bindRuleGraphFragmentRole',fromRole:field.label.slice('岗位绑定 '.length),role:choice.value});
 }
 assert.equal((await state()).fragments.ready,true);assert.deepEqual((await state()).graph.graph,before);
 await action({type:'confirmRuleGraphFragment'});const inserted=await state();assert.equal(inserted.fragments.selected,null);assert.equal(inserted.graph.graph.nodes.length,before.nodes.length+saved.fragment.nodes.length);assert.notEqual(inserted.graph.graph.states.find(s=>s.id===target.id).treeId,target.treeId);
 if(evidence){const image=await client.callTool({name:'Page.captureScreenshot',arguments:{}});assert(!image.isError);await writeFile(evidence+'/inserted.png',Buffer.from(image.content[0].data,'base64'));}
 report.inserted=inserted.graph;await action({type:'undoRuleGraph'});const undone=(await state()).graph.graph;assert.deepEqual(undone,before);report.undone=undone;report.completed=true;
});
