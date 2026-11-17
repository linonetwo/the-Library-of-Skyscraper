import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { art,keepPixel,place,clearCell,sourceProvenance } from './idle-pipeline.mjs';
import { extractSourceSprites } from './source-sprites.mjs';
import { frontArms } from './four-head-registration.mjs';
import { walkPoseSources,registeredWalkPose } from './four-head-walk-poses.mjs';
import { directions,frameName } from './animation-spec.mjs';
import { sourceGripTracks,staffDepth } from './staff-registration.mjs';
import { dollLayers } from './four-head-idle.mjs';

const source=async(name,columns,rows)=>extractSourceSprites(await readFile(new URL(`source/${name}`,art)),{columns,rows,keepPixel});
const hands=[
  [[8,113],[7,128],[7,138],[7,127]], [[6,109],[6,124],[7,130],[7,125]],
  [[11,108],[8,124],[26,126],[9,124]], [[99,130],[81,128],[100,129],[88,128]],
  [[77,131],[77,130],[89,115],[76,130]], [[92,128],[83,130],[99,131],[86,130]],
  [[25,131],[18,129],[24,130],[12,129]], [[7,119],[8,127],[7,130],[7,126]],
];
const leftHands=[
  [[72,137],[73,137],[74,111],[75,132]],[[94,132],[81,132],[96,118],[83,132]],
  [[96,132],[71,133],[100,127],[73,131]],[[12,112],[8,129],[19,127],[7,128]],
  [[7,114],[8,128],[8,135],[8,129]],[[7,117],[9,121],[7,131],[8,129]],
  [[99,112],[63,120],[106,112],[68,119]],[[87,132],[72,129],[97,105],[73,127]],
];
const garments=[[77,55,38,62],[78,55,36,62],[85,55,25,62],[79,55,35,62],
  [77,55,38,62],[78,55,36,62],[82,55,25,62],[78,55,36,62]];
export async function walkFrames() {
  const bodies=await walkPoseSources(),clothes={},hair={};
  for(const name of ['scholar','warden'])clothes[name]=await source(`four-head-walk-${name}.png`,4,8);
  for(const name of ['ivory','midnight'])hair[name]=await source(`walk-hair-${name}.png`,4,8);
  const staff=await source('walk-weapon-staff.png',4,8),grips=await source('grip-hands.png',2,4);
  const cells={},recipes={},frames=[],attachments=[],provenance={};
  for(const layer of dollLayers){cells[layer]=Array.from({length:8},()=>[]);recipes[layer]=[];}
  const bodyProv=await sourceProvenance('four-head-walk-body.png','four-head-walk-body-prompt.txt',
    '32 independently generated walking poses; registered against reviewed neutral four-head skeleton, no neutral pose substitution.');
  provenance.body=bodyProv;provenance['body-front']=bodyProv;
  for(const layer of ['body','body-front'])provenance[layer]={...bodyProv,correctionSources:await Promise.all(
    ['four-head-walk-opposite','four-head-walk-right-views'].map(name=>sourceProvenance(`${name}.png`,`${name}-prompt.txt`,
      'Targeted opposite-half correction candidates; see per-frame bodySource and independent review record.')))};
  for(const name of ['scholar','warden'])provenance[`outfit-${name}`]={
    ...await sourceProvenance(`four-head-walk-${name}.png`,`four-head-walk-${name}-prompt.txt`,
      '32 independently generated walking garment poses of the same four-head neutral costume design.'),designSource:'arena/art/source/four-head-outfits.png'};
  for(const name of ['ivory','midnight'])for(const suffix of ['','-back','-front'])
    provenance[`hair-${name}${suffix}`]=await sourceProvenance(`walk-hair-${name}.png`,`walk-hair-${name}-prompt.txt`,
      'Four dedicated directional hair poses re-registered to four-head crowns, with split hanging locks.');
  for(const suffix of ['','-back','-front'])provenance[`weapon-staff${suffix}`]=await sourceProvenance(
    'walk-weapon-staff.png','walk-weapon-staff-prompt.txt','Shared directional staff design; independently authored four-head walk hand tracks and carry angles.');
  provenance['hand-grip']=await sourceProvenance('grip-hands.png','grip-hands-prompt.txt','Closed fingers registered over each corresponding shaft and original body palm.');
  const empty=await clearCell().png().toBuffer();
  for(let row=0;row<8;row++)for(let col=0;col<4;col++) {
    const index=row*4+col,bob=[0,.6,0,.4][col];
    const body=await registeredWalkPose(bodies,row,col,hands[row][col],leftHands[row][col]);
    cells.body[row].push(body.image);cells['body-front'][row].push(await frontArms(body.image));
    const hand=body.points.rightHand,points={crown:[96,12+bob],neck:[96,56+bob],hip:[96,112],...body.points};
    const entry={frame:frameName('walk','body',directions[row],col),...body.recipe,attachments:points,durationMs:125,
      phase:['contact-a','passing-a','opposite-contact','opposite-passing'][col],sourcePoseRetained:true};
    frames.push(entry);
    for(const name of ['scholar','warden']) {
      const p=[...garments[row]];p[1]+=Math.round(bob);if(name==='warden'){p[0]-=3;p[2]+=6;}
      cells[`outfit-${name}`][row].push(await place(clothes[name].sprites[index].image,p));
    }
    for(const name of ['ivory','midnight']) {
      const width=name==='ivory'?46:49;
      const image=await place(hair[name].sprites[index].image,[Math.round(96-width/2),Math.round(7+bob),width,43]);
      cells[`hair-${name}`][row].push(image);
      const {data,info}=await sharp(image).raw().toBuffer({resolveWithObject:true}),back=Buffer.alloc(data.length),front=Buffer.from(data);
      for(let y=39+Math.round(bob);y<192;y++)for(let x=0;x<192;x++)if(x<84||x>108) {
        const p=(y*192+x)*4;data.copy(back,p,p,p+4);front.fill(0,p,p+4);
      }
      for(const [depth,raw] of [['back',back],['front',front]])cells[`hair-${name}-${depth}`][row].push(await sharp(raw,{raw:info}).png().toBuffer());
    }
    const weapon=staff.sprites[row*4],{crop}=weapon,[gx,gy]=sourceGripTracks[row][0];
    const angle=row===6?[-18,-16,-22,-17][col]:(row<3?-1:1)*[8,4,12,6][col],rad=angle*Math.PI/180;
    const rotated=await sharp(weapon.image).rotate(angle,{background:'#00000000'}).png().toBuffer(),meta=await sharp(rotated).metadata();
    const local=[gx-crop.x,gy-(crop.y-Math.round(row*staff.sourceSize[1]/8))];
    const cx=meta.width/2+(local[0]-crop.w/2)*Math.cos(rad)-(local[1]-crop.h/2)*Math.sin(rad);
    const cy=meta.height/2+(local[0]-crop.w/2)*Math.sin(rad)+(local[1]-crop.h/2)*Math.cos(rad);
    const w=Math.round(meta.width*.48),h=Math.round(meta.height*.48),p=[Math.round(hand[0]-cx*w/meta.width),Math.round(hand[1]-cy*h/meta.height),w,h];
    const staffCell=await place(rotated,p);cells['weapon-staff'][row].push(staffCell);
    for(const depth of ['back','front'])cells[`weapon-staff-${depth}`][row].push(staffDepth[row]===depth?staffCell:empty);
    cells['hand-grip'][row].push(await place(grips.sprites[row].image,[Math.round(hand[0]-3.5),Math.round(hand[1]-6.2),7,10]));
    const attachment={frame:frameName('walk','weapon-staff',directions[row],col),hand:'right',grip:{x:hand[0],y:hand[1]},
      carryLeanDegrees:angle,depth:staffDepth[row],placement:p,sourceHandCenter:body.sourceHands.right,
      bodySource:body.recipe.bodySource,durationMs:125};
    attachments.push(attachment);
    for(const layer of dollLayers)recipes[layer].push({frame:frameName('walk',layer,directions[row],col),
      bodyFrame:entry.frame,durationMs:125,sourceCrop:body.recipe.sourceCrop,bodySource:body.recipe.bodySource,
      ...(layer.startsWith('weapon')||layer==='hand-grip'?{attachment}:{}),
      ...(layer.startsWith('outfit')?{sourceCrop:clothes[layer.slice(7)].sprites[index].crop,
        placement:[garments[row][0]-(layer.endsWith('warden')?3:0),garments[row][1]+Math.round(bob),
          garments[row][2]+(layer.endsWith('warden')?6:0),garments[row][3]]}:{}),
      ...(layer.startsWith('hair')?{sourceCrop:hair[layer.includes('ivory')?'ivory':'midnight'].sprites[index].crop,
        placement:[Math.round(96-(layer.includes('ivory')?46:49)/2),Math.round(7+bob),layer.includes('ivory')?46:49,43]}:{}),
      ...(layer.startsWith('weapon')?{sourceCrop:crop,placement:p}:{}),
      ...(layer==='hand-grip'?{sourceCrop:grips.sprites[row].crop,placement:[Math.round(hand[0]-3.5),Math.round(hand[1]-6.2),7,10]}:{})});
  }
  return {action:'walk',cells,recipes,frames,attachments,provenance};
}
