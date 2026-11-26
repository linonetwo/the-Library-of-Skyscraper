import {z} from 'zod';
const id=z.string().min(1).max(160),role=z.enum(['scout','gatherer','guard']);
export const fragmentActionSchemas=[
 ...['openRuleGraphFragments','confirmRuleGraphFragment','cancelRuleGraphFragment'].map(type=>z.object({type:z.literal(type)}).strict()),
 z.object({type:z.literal('saveRuleGraphFragment'),name:z.string().trim().min(1).max(200)}).strict(),
 z.object({type:z.literal('previewRuleGraphFragment'),fragmentId:id}).strict(),
 z.object({type:z.literal('setRuleGraphFragmentTarget'),stateId:id}).strict(),
 z.object({type:z.literal('bindRuleGraphFragmentRoom'),fromRoomId:id,roomId:id}).strict(),
 z.object({type:z.literal('bindRuleGraphFragmentRole'),fromRole:role,role}).strict(),
];
export async function performFragmentAction(page,action){
 if(!fragmentActionSchemas.some(schema=>schema.shape.type.value===action.type))return false;
 const panel=page.locator('details.graph-fragments');await panel.waitFor({state:'visible'});
 if(await panel.getAttribute('open')===null)await panel.locator('summary').first().click();
 if(action.type==='saveRuleGraphFragment'){
  await panel.getByRole('textbox',{name:'片段名称',exact:true}).fill(action.name);
  await panel.getByRole('button',{name:'保存所选子树',exact:true}).click();
 }else if(action.type==='previewRuleGraphFragment'){
  const buttons=panel.locator('button[data-fragment-id]');
  const ids=await buttons.evaluateAll(items=>items.map(item=>item.dataset.fragmentId));
  const index=ids.indexOf(action.fragmentId);if(index<0)throw Error('Visible saved fragment does not exist');
  await buttons.nth(index).click();
 }else if(action.type==='setRuleGraphFragmentTarget')await panel.getByLabel('片段插入状态',{exact:true}).selectOption(action.stateId);
 else if(action.type==='bindRuleGraphFragmentRoom')await panel.getByLabel(`原房间 ${action.fromRoomId} → 目标房间`,{exact:true}).selectOption(action.roomId);
 else if(action.type==='bindRuleGraphFragmentRole')await panel.getByLabel(`岗位绑定 ${action.fromRole}`,{exact:true}).selectOption(action.role);
 else if(action.type==='confirmRuleGraphFragment')await panel.getByRole('button',{name:'确认插入并连接',exact:true}).click();
 else if(action.type==='cancelRuleGraphFragment')await panel.getByRole('button',{name:'返回片段列表',exact:true}).click();
 return true;
}
export async function readFragmentState(page){
 const panel=page.locator('details.graph-fragments');if(!await panel.isVisible())return{visible:false};
 const state=JSON.parse(await panel.getAttribute('data-fragment-state'));
 return{visible:true,open:await panel.getAttribute('open')!==null,...state,
  controls:await panel.locator('select').evaluateAll(items=>items.map(item=>({label:item.getAttribute('aria-label'),value:item.value,options:[...item.options].map(option=>({value:option.value,label:option.label}))}))),
  alerts:await panel.getByRole('alert').allTextContents()};
}
