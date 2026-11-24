import { z } from 'zod';
const directions = {S:'正面', SW:'左前', W:'左侧', NW:'左后', N:'背面', NE:'右后', E:'右侧', SE:'右前'};
const empty = ['openWorkshop','returnToArena','playWorkshop','pauseWorkshop','stepWorkshop'];
const fields = {
 setWorkshopAction:{action:z.enum(['idle','walk'])},
 selectWorkshopDirection:{direction:z.enum(Object.keys(directions))},
 setWorkshopFps:{fps:z.union([2,4,8,12].map(z.literal))},
 setWorkshopOutfit:{outfit:z.enum(['scholar','warden'])},
 setWorkshopHair:{hair:z.enum(['ivory','midnight'])},
 setWorkshopLayer:{layer:z.enum(['outfit','hair','weapon']),visible:z.boolean()},
};
export const workshopActionSchemas = [...empty.map(type=>z.object({type:z.literal(type)}).strict()),
 ...Object.entries(fields).map(([type,shape])=>z.object({type:z.literal(type),...shape}).strict())];
const gallery = page=>page.getByRole('region',{name:'八方向动画预览'});
async function loaded(page) { await gallery(page).getByRole('img').nth(7).waitFor(); }
function layerControl(page,layer) {
 return page.getByRole('checkbox',{name:layer==='outfit'?/服动画层/:layer==='hair'?/发型动画层/:'法杖动画层'});
}
export async function performWorkshopAction(page, action) {
 if(!empty.includes(action.type) && !(action.type in fields)) return false;
 if(action.type==='openWorkshop') { await page.goto(new URL('/animation-lab', page.url()).href); await loaded(page); return true; }
 if(action.type==='returnToArena') { await page.getByRole('link',{name:'← 返回竞技场',exact:true}).click(); return true; }
 const button=name=>page.getByRole('button',{name,exact:true});
 switch(action.type) {
  case 'setWorkshopAction': {
   const control=page.getByLabel('动作',{exact:true});
   if(await control.inputValue()!==action.action) await control.selectOption(action.action);
   await loaded(page); break;
  }
  case 'selectWorkshopDirection': await button(`${directions[action.direction]} ${action.direction}`).click(); break;
  case 'playWorkshop': if(await button('播放动画').count()) await button('播放动画').click(); break;
  case 'pauseWorkshop': if(await button('暂停动画').count()) await button('暂停动画').click(); break;
  case 'stepWorkshop': await button('下一帧').click(); break;
  case 'setWorkshopFps': await page.getByLabel('播放速度').selectOption(String(action.fps)); break;
  case 'setWorkshopOutfit': await page.getByLabel('动画衣装').selectOption(action.outfit); break;
  case 'setWorkshopHair': await page.getByLabel('动画发型').selectOption(action.hair); break;
  case 'setWorkshopLayer': await layerControl(page,action.layer).setChecked(action.visible); break;
 }
 return true;
}
export async function readWorkshopState(page) {
 if(new URL(page.url()).pathname!=='/animation-lab') return null;
 const [, frame, frameCount]=(await page.getByLabel('当前帧').innerText()).match(/帧 (\d+) \/ (\d+)/);
 const value=label=>page.getByLabel(label,{exact:true}).inputValue();
 const selection=gallery(page).locator('[aria-pressed=true]');
 const selected=await selection.count()?await selection.getAttribute('aria-label'):null;
 return {action:await value('动作'),direction:selected?.split(' ').at(-1) ?? null,
  frame:Number(frame)-1,frameCount:Number(frameCount),
  fps:Number(await value('播放速度')),playing:await page.getByRole('button',{name:'暂停动画',exact:true}).count()>0,
  appearance:{outfit:await value('动画衣装'),hair:await value('动画发型'),weapon:await layerControl(page,'weapon').isChecked()},
  layers:{outfit:await layerControl(page,'outfit').isChecked(),hair:await layerControl(page,'hair').isChecked()},
  loading:await page.locator('[role=status]').count()>0,error:await page.getByRole('alert').count()?await page.getByRole('alert').innerText():null};
}
