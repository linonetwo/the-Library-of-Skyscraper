import {z} from 'zod';
const text=z.string().min(1).max(200),value=z.union([z.string().max(4000),z.number().finite(),z.boolean()]);
const clicks={openCustomModuleLibrary:'我的模块',createCustomModule:'创建自定义模块',returnCustomModuleLibrary:'返回我的模块',addCustomModuleField:'添加参数',addCustomModuleExit:'添加命名出口',compileCustomModule:'编译模块',saveCustomModule:'保存到我的模块',confirmCustomModuleUpgrade:'将此实例升级至所选版本',cancelCustomModuleUpgrade:'返回当前版本',editCurrentCustomModule:'编辑此模块本体',locateCustomModuleCall:'看调用处',locateCustomModuleBody:'看本体源码'};
export const customModuleActionSchemas=[
 ...Object.keys(clicks).map(type=>z.object({type:z.literal(type)}).strict()),
 z.object({type:z.literal('setCustomModuleView'),view:z.enum(['shape','source'])}).strict(),
 z.object({type:z.literal('setCustomModuleField'),scope:z.enum(['author','upgrade','instance']).default('author'),label:text,value}).strict(),
 z.object({type:z.literal('removeCustomModuleField'),index:z.number().int().min(0).max(100)}).strict(),
 z.object({type:z.literal('removeCustomModuleExit'),index:z.number().int().min(0).max(100)}).strict(),
 z.object({type:z.literal('editCustomModuleSource'),source:z.string().max(200000)}).strict(),
 z.object({type:z.literal('selectCustomModuleVersion'),revisionId:text}).strict(),
 z.object({type:z.literal('useCustomModuleLibraryItem'),operation:z.enum(['add','edit','remove']),name:text,revisionPrefix:z.string().length(12)}).strict(),
 z.object({type:z.literal('selectRecordedCustomExit'),exitKey:z.string().max(200)}).strict(),
];
export async function performCustomModuleAction(page,action){
 if(!customModuleActionSchemas.some(s=>s.shape.type.value===action.type))return false;
 const author=page.getByRole('region',{name:'编辑模块本体',exact:true}),upgrade=page.getByRole('region',{name:'模块本体版本',exact:true});
 if(action.type==='createCustomModule'){
  const library=page.getByRole('region',{name:'我的模块',exact:true});
  await (await library.isVisible()?library.getByRole('button',{name:'新建自定义模块',exact:true}):page.getByRole('button',{name:'创建自定义模块',exact:true})).click();
 }else if(action.type==='setCustomModuleView')await author.getByRole('tab',{name:action.view==='shape'?'参数与出口':'行为 TypeScript',exact:true}).click();
 else if(action.type==='setCustomModuleField'){
  const scope=action.scope==='upgrade'?upgrade:action.scope==='instance'?page.locator('.custom-module-fields'):author;
  const control=scope.getByLabel(action.label,{exact:true});const tag=await control.evaluate(el=>el.tagName);
  if(tag==='SELECT')await control.selectOption(String(action.value));
  else if(typeof action.value==='boolean')await control.setChecked(action.value);
  else await control.fill(String(action.value));
 }else if(action.type==='editCustomModuleSource'){
  await author.getByRole('tab',{name:'行为 TypeScript',exact:true}).click();
  await page.evaluate(source=>navigator.clipboard.writeText(source),action.source);
  await author.getByRole('textbox',{name:'TypeScript规则源码',exact:true}).focus();
  await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('ControlOrMeta+v');
 }else if(action.type==='removeCustomModuleField'||action.type==='removeCustomModuleExit')await author.getByRole('button',{name:`删除${action.type==='removeCustomModuleField'?'参数':'出口'} ${action.index+1}`,exact:true}).click();
 else if(action.type==='selectCustomModuleVersion')await upgrade.getByLabel('模块升级版本',{exact:true}).selectOption(action.revisionId);
 else if(action.type==='useCustomModuleLibraryItem')await page.getByRole('region',{name:'我的模块',exact:true}).getByRole('button',{name:`${{add:'添加自定义模块',edit:'编辑模块本体',remove:'移除收藏'}[action.operation]} ${action.name} ${action.revisionPrefix}`,exact:true}).click();
 else if(action.type==='selectRecordedCustomExit')await page.getByRole('region',{name:'录制断点与覆盖',exact:true}).getByLabel('录制命名出口',{exact:true}).selectOption(action.exitKey);
 else {
  const panel=action.type.startsWith('locate')?page.getByRole('region',{name:'录制断点与覆盖',exact:true}):['confirmCustomModuleUpgrade','cancelCustomModuleUpgrade','editCurrentCustomModule'].includes(action.type)?upgrade:['returnCustomModuleLibrary','addCustomModuleField','addCustomModuleExit','compileCustomModule','saveCustomModule'].includes(action.type)?author:page;
  await panel.getByRole('button',{name:clicks[action.type],exact:true}).click();
 }
 return true;
}
export async function readCustomModuleState(page){
 const result={};
 for(const [key,label] of [['author','编辑模块本体'],['library','我的模块'],['upgrade','模块本体版本']]){
  const panel=page.getByRole('region',{name:label,exact:true});
  result[key]=await panel.isVisible()?{text:(await panel.innerText()).slice(0,16000),controls:await panel.locator('input,select').evaluateAll(items=>items.map(el=>({label:el.getAttribute('aria-label')||[...(el.labels??[])].map(l=>l.textContent.trim()).join(' '),value:el.value,...(el.type==='checkbox'?{checked:el.checked}:{}),...(el.tagName==='SELECT'?{options:[...el.options].map(o=>({value:o.value,label:o.label}))}:{})}))),sourceLines:await panel.locator('.monaco-editor .view-lines').allTextContents(),buttons:await panel.getByRole('button').evaluateAll(items=>items.map(el=>({label:el.getAttribute('aria-label')||el.textContent.trim(),disabled:el.disabled}))),alerts:await panel.getByRole('alert').allTextContents()}:null;
 }
 return result;
}
