import {z} from 'zod';
const id=z.string().min(1).max(160),op=z.number().int().min(0);
export const recordingActionSchemas=[
 ...['refreshRecording','nextRecording','previousRecording','openRecordedSource','useFullRecordingRange','refreshRuleComparison','compareRuleOperation'].map(type=>z.object({type:z.literal(type)}).strict()),
 z.object({type:z.literal('selectRecordingVersion'),sourceHash:id}).strict(),
 z.object({type:z.literal('selectRecordingActor'),actorId:id}).strict(),
 z.object({type:z.literal('selectRecordingObjectType'),target:z.enum(['node','module'])}).strict(),
 z.object({type:z.literal('selectRecordingObject'),objectId:id}).strict(),
 z.object({type:z.literal('setRecordingHitKind'),kind:z.enum(['visit','hit','fallback'])}).strict(),
 z.object({type:z.literal('setRecordingCursor'),operationIndex:z.number().int().min(-1)}).strict(),
 z.object({type:z.literal('saveRecordingRange'),name:z.string().trim().min(1).max(200),fromOperation:op,toOperation:op}).strict(),
 z.object({type:z.literal('selectSavedRecording'),index:op}).strict(),
 z.object({type:z.literal('locateRecordingCoverage'),objectId:id,column:z.enum(['访问','命中','回退','未访问','缺记录','截断','路径缺失','未记录访问']),total:op}).strict(),
 z.object({type:z.literal('setRuleComparisonOperation'),operationIndex:op}).strict(),
 z.object({type:z.literal('setRuleComparisonBaseline'),sourceHash:z.string().max(160)}).strict(),
];
export async function performRecordingAction(page,action){
 if(!recordingActionSchemas.some(s=>s.shape.type.value===action.type))return false;
 const panel=page.getByRole('region',{name:'录制断点与覆盖',exact:true}),comparison=page.getByRole('region',{name:'同帧规则对照',exact:true});
 const select={selectRecordingVersion:['录制源版本',action.sourceHash],selectRecordingActor:['录制角色',action.actorId],selectRecordingObjectType:['录制对象类型',action.target],selectRecordingObject:['录制对象',action.objectId],setRecordingHitKind:['录制命中类型',action.kind],selectSavedRecording:['已存具名录制',String(action.index)]}[action.type];
 if(select)await panel.getByLabel(select[0],{exact:true}).selectOption(select[1]);
 else if(action.type==='setRecordingCursor')await panel.getByLabel('录制操作游标',{exact:true}).fill(String(action.operationIndex));
 else if(action.type==='saveRecordingRange'){
  await panel.getByLabel('具名录制名称',{exact:true}).fill(action.name);await panel.getByLabel('录制区间起点',{exact:true}).fill(String(action.fromOperation));await panel.getByLabel('录制区间终点',{exact:true}).fill(String(action.toOperation));await panel.getByRole('button',{name:'保存具名区间',exact:true}).click();
 }else if(action.type==='locateRecordingCoverage')await panel.getByRole('table',{name:'具名录制覆盖计数',exact:true}).getByRole('button',{name:`${action.objectId} ${action.column} ${action.total}`,exact:true}).click();
 else if(action.type==='setRuleComparisonOperation')await comparison.getByLabel('录制操作N',{exact:true}).fill(String(action.operationIndex));
 else if(action.type==='setRuleComparisonBaseline')await comparison.getByLabel('A基线版本',{exact:true}).selectOption(action.sourceHash);
 else {
  const labels={refreshRecording:'刷新本人录制',nextRecording:'下一次记录',previousRecording:'上一次记录',openRecordedSource:'打开该版只读源码',useFullRecordingRange:'使用整份录制操作范围',refreshRuleComparison:'刷新实录与版本',compareRuleOperation:'比较同一操作帧'};
  await (action.type==='refreshRuleComparison'||action.type==='compareRuleOperation'?comparison:panel).getByRole('button',{name:labels[action.type],exact:true}).click();
 }
 return true;
}
async function fields(panel){return panel.locator('input,select').evaluateAll(items=>items.map(el=>({label:el.getAttribute('aria-label'),value:el.value,...(el.tagName==='SELECT'?{options:[...el.options].map(o=>({value:o.value,label:o.label}))}:{min:el.min,max:el.max})})));}
export async function readRecordingState(page){
 const panel=page.getByRole('region',{name:'录制断点与覆盖',exact:true});if(!await panel.isVisible())return{visible:false};
 const raw=await panel.getAttribute('data-recording-state'),fact=panel.locator('[aria-label="录制命中事实"]'),source=panel.locator('.readonly-rule-source');
 return{visible:true,...(raw?JSON.parse(raw):{}),fields:await fields(panel),fact:await fact.count()?await fact.innerText():null,status:await panel.getByRole('status').allTextContents(),alerts:await panel.getByRole('alert').allTextContents(),
  coverage:await panel.getByRole('table',{name:'具名录制覆盖计数',exact:true}).locator('tbody tr').evaluateAll(rows=>rows.map(row=>({objectId:row.querySelector('th')?.textContent,text:row.textContent,links:[...row.querySelectorAll('button')].map(button=>({label:button.getAttribute('aria-label'),title:button.title,text:button.textContent}))}))),
  source:await source.count()?{text:(await source.innerText()).slice(0,20000),selectedLine:await source.locator('[data-selected-source-line]').allTextContents(),location:await panel.locator('details[open] summary').allTextContents()}:null};
}
export async function readRuleComparisonState(page){
 const panel=page.getByRole('region',{name:'同帧规则对照',exact:true});if(!await panel.isVisible())return{visible:false};
 const candidates=[];for(const side of ['A','B']){const candidate=panel.getByRole('article',{name:side+'版结果',exact:true});if(await candidate.count())candidates.push({side,hash:await candidate.locator(':scope > code').innerText(),text:await candidate.innerText(),pre:await candidate.locator('pre').allTextContents()});}
 return{visible:true,fields:await fields(panel),status:await panel.getByRole('status').allTextContents(),alerts:await panel.getByRole('alert').allTextContents(),candidates,text:(await panel.innerText()).slice(0,20000)};
}
