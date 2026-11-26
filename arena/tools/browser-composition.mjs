import {z} from 'zod';
const id=z.string().min(1).max(160);
const names={scout:'侦察',patrol:'巡逻',escort:'护送',gather:'采集藏材',haul:'运输入库',build:'建造设施',defend:'据点防守',retreat:'低血撤退'};
export const compositionActionSchemas=[
 ...['openRuleModuleCatalog','confirmRuleModuleConversion','confirmRuleModule','cancelRuleModulePreview','copyRuleModuleInstance','addRulePatrolStop'].map(type=>z.object({type:z.literal(type)}).strict()),
 z.object({type:z.literal('previewRuleModule'),kind:z.enum(Object.keys(names))}).strict(),
 z.object({type:z.literal('previewSharedRuleModule'),moduleId:id}).strict(),
 z.object({type:z.literal('setRuleModuleTarget'),stateId:id}).strict(),
 z.object({type:z.literal('selectRuleModuleCopyReference'),nodeId:id,selected:z.boolean()}).strict(),
 z.object({type:z.literal('removeRulePatrolStop'),index:z.number().int().min(0).max(100)}).strict(),
];
export async function performCompositionAction(page,action){
 if(!compositionActionSchemas.some(s=>s.shape.type.value===action.type))return false;
 const catalog=page.getByRole('region',{name:'模块目录',exact:true});
 const preview=page.getByRole('region',{name:'模块接入预览',exact:true});
 const conversion=page.getByRole('region',{name:'五卡转换预览',exact:true});
 const open=async()=>{const button=catalog.getByRole('button',{name:'＋添加模块',exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();};
 if(action.type==='openRuleModuleCatalog')await open();
 else if(action.type==='previewRuleModule'){await open();await catalog.getByRole('button',{name:'选择模块 '+names[action.kind],exact:true}).click();}
 else if(action.type==='previewSharedRuleModule'){await open();await catalog.getByLabel('引用已有模块实例',{exact:true}).selectOption(action.moduleId);}
 else if(action.type==='confirmRuleModuleConversion')await conversion.getByRole('button',{name:'确认转换并继续添加',exact:true}).click();
 else if(action.type==='setRuleModuleTarget')await preview.getByLabel('模块接入状态',{exact:true}).selectOption(action.stateId);
 else if(action.type==='confirmRuleModule')await preview.getByRole('button',{name:'确认接入模块',exact:true}).click();
 else if(action.type==='cancelRuleModulePreview'){
  if(await conversion.isVisible())await conversion.getByRole('button',{name:'返回五卡',exact:true}).click();
  else await (await preview.isVisible()?preview:catalog).getByRole('button',{name:'返回编排',exact:true}).click();
 }else if(action.type==='selectRuleModuleCopyReference')await page.locator('.module-instance-links').getByRole('checkbox',{name:'独立改绑 '+action.nodeId,exact:true}).setChecked(action.selected);
 else if(action.type==='copyRuleModuleInstance')await page.locator('.module-instance-links').getByRole('button',{name:'复制独立实例并改绑所选引用',exact:true}).click();
 else {
  const fields=await preview.isVisible()?preview:page.getByRole('region',{name:'选中规则对象参数',exact:true});
  await fields.getByRole('button',{name:action.type==='addRulePatrolStop'?'添加巡逻站点':'删除站点 '+(action.index+1),exact:true}).click();
 }
 return true;
}
export async function readCompositionState(page){
 const catalog=page.getByRole('region',{name:'模块目录',exact:true}),preview=page.getByRole('region',{name:'模块接入预览',exact:true}),conversion=page.getByRole('region',{name:'五卡转换预览',exact:true}),links=page.locator('.module-instance-links');
 const fields=async panel=>panel.locator('input,select').evaluateAll(items=>items.map(el=>({label:el.getAttribute('aria-label')||[...(el.labels??[])].map(l=>l.textContent.trim()).join(' '),tag:el.tagName,type:el.type,value:el.value,...(el.type==='checkbox'?{checked:el.checked}:{}),...(el.tagName==='SELECT'?{options:[...el.options].map(o=>({value:o.value,label:o.label}))}:{})})));
 return{visible:await catalog.isVisible(),catalog:await catalog.isVisible()?{expanded:await catalog.getByRole('button',{name:'＋添加模块',exact:true}).getAttribute('aria-expanded')==='true',text:await catalog.innerText(),fields:await fields(catalog)}:null,
  conversion:await conversion.isVisible()?{text:await conversion.innerText()}:null,
  preview:await preview.isVisible()?{text:await preview.innerText(),fields:await fields(preview)}:null,
  references:await links.isVisible()?{text:await links.innerText(),fields:await fields(links)}:null};
}
