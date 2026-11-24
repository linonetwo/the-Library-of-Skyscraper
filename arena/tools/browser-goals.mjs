import {z} from 'zod';
export const goalActionSchemas = [
  z.object({type:z.literal('proposeRuleGoals'),text:z.string().min(1).max(4000)}).strict(),
  z.object({type:z.literal('selectRuleGoalChange'),changeId:z.string().min(1),selected:z.boolean()}).strict(),
  z.object({type:z.literal('locateRuleGoalObject'),changeId:z.string().min(1)}).strict(),
  ...['acceptRuleGoalChanges','rejectRuleGoalChanges','undoRuleGoalChanges'].map(type=>z.object({type:z.literal(type)}).strict()),
];
export async function performGoalAction(page,action){
  if(!['proposeRuleGoals','selectRuleGoalChange','locateRuleGoalObject','acceptRuleGoalChanges','rejectRuleGoalChanges','undoRuleGoalChanges'].includes(action.type))return false;
  const panel=page.getByRole('region',{name:'中文目标与补丁',exact:true});
  await panel.waitFor({state:'visible'});
  if(action.type==='proposeRuleGoals'){
    await panel.getByRole('textbox',{name:'目标语句',exact:true}).fill(action.text);
    await panel.getByRole('button',{name:'生成目标差异',exact:true}).click();
  }else if(action.type==='selectRuleGoalChange'||action.type==='locateRuleGoalObject'){
    const changes=panel.locator('[data-goal-change]');
    const ids=await changes.evaluateAll(items=>items.map(item=>item.getAttribute('data-goal-change')));
    const index=ids.indexOf(action.changeId);
    if(index<0)throw new Error('Visible goal change does not exist: '+action.changeId);
    const change=changes.nth(index);
    if(action.type==='selectRuleGoalChange')await change.getByRole('checkbox').setChecked(action.selected);
    else await change.getByRole('button',{name:'定位对象',exact:true}).click();
  }else{
    const labels={acceptRuleGoalChanges:'采纳所选差异',rejectRuleGoalChanges:'拒绝本次提案',undoRuleGoalChanges:'撤销目标采纳'};
    await panel.getByRole('button',{name:labels[action.type],exact:true}).click();
  }
  return true;
}
export async function readGoalState(page){
  const panel=page.getByRole('region',{name:'中文目标与补丁',exact:true});
  if(!await panel.isVisible())return {visible:false};
  return {visible:true,text:await panel.getByRole('textbox',{name:'目标语句',exact:true}).inputValue(),status:await panel.getByRole('status',{name:'目标补丁状态',exact:true}).innerText(),changes:await panel.locator('[data-goal-change]').evaluateAll(items=>items.map(item=>({changeId:item.getAttribute('data-goal-change'),text:item.innerText,selected:item.querySelector('input[type=checkbox]')?.checked}))),alerts:await panel.getByRole('alert').allTextContents()};
}
