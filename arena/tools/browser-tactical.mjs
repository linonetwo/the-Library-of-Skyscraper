import {z} from 'zod';
export const tacticalKinds=['attack','repair','claim','cast'];
const confirmLabels={attack:'确认集火',repair:'确认修复',claim:'确认占领',cast:'确认定向墨印'};
export const tacticalActionSchemas=[
 z.object({type:z.literal('selectSessionScenario'),scenarioId:z.enum(['first-expedition','seal-contest'])}).strict(),
 z.object({type:z.literal('chooseTacticalAction'),kind:z.enum(tacticalKinds)}).strict(),
 z.object({type:z.literal('selectTacticalTarget'),targetId:z.string().min(1).max(160)}).strict(),
 ...['confirmTacticalAction','openTacticalAI','openTacticalDetails'].map(type=>z.object({type:z.literal(type)}).strict()),
];
export async function performTacticalAction(page,action){
 if(!tacticalActionSchemas.some(s=>s.shape.type.value===action.type))return false;
 if(action.type==='selectSessionScenario')await page.getByLabel('创建赛局场景',{exact:true}).selectOption(action.scenarioId);
 else {
  const panel=page.getByRole('region',{name:'战术行动',exact:true});
  if(action.type==='chooseTacticalAction')await panel.getByLabel('战术行动',{exact:true}).selectOption(action.kind);
  else if(action.type==='selectTacticalTarget')await panel.getByLabel('战术目标',{exact:true}).selectOption(action.targetId);
  else if(action.type==='confirmTacticalAction'){
   const kind=await panel.getByLabel('战术行动',{exact:true}).inputValue();
   await panel.getByRole('button',{name:confirmLabels[kind],exact:true}).click();
  }else if(action.type==='openTacticalAI')await panel.getByRole('button',{name:'查看当前 AI 规则',exact:true}).click();
  else {const details=panel.locator('details');if(await details.getAttribute('open')===null)await details.locator('summary').click();}
 }
 return true;
}
export async function readTacticalState(page){
 const panel=page.getByRole('region',{name:'战术行动',exact:true});if(!await panel.isVisible())return{visible:false};
 return{visible:true,text:await panel.innerText(),choices:await panel.locator('select').evaluateAll(items=>items.map(el=>({label:el.getAttribute('aria-label'),value:el.value,options:[...el.options].map(o=>({value:o.value,label:o.label,disabled:o.disabled}))}))),buttons:await panel.getByRole('button').evaluateAll(items=>items.map(el=>({label:el.textContent.trim(),disabled:el.disabled}))),status:await panel.getByRole('status').allTextContents()};
}
