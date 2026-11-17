import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { art,keepPixel } from './idle-pipeline.mjs';
import { extractSourceSprites } from './source-sprites.mjs';
import { normalizeNeutral } from './four-head-registration.mjs';
import { cellPng } from './motion-registration.mjs';
import { repairLegs } from './four-head-leg-repair.mjs';
import { lowerPassing,restoreLegVolume } from './four-head-walk-balance.mjs';

const load=async(name,columns,rows)=>extractSourceSprites(await readFile(new URL(`source/${name}`,art)),{columns,rows,keepPixel});
const oppositeHands=[[[7,124],[9,93]],[[86,123],[92,124]],[[121,126],[117,126]],[[126,128],[110,128]]];
const oppositeLeft=[[[73,109],[70,123]],[[16,108],[8,92]],[[16,107],[9,89]],[[10,106],[9,88]]];
export async function walkPoseSources() {
  return {original:await load('four-head-walk-body.png',4,8),opposite:await load('four-head-walk-opposite.png',2,8),
    right:await load('four-head-walk-right-views.png',2,3)};
}
export async function registeredWalkPose(sources,row,col,rightHand,leftHand) {
  let sprite=sources.original.sprites[row*4+col],sourceName='four-head-walk-body.png',right=rightHand,left=leftHand;
  const mirrored=row===4&&col>=2;
  if(col>=2&&row<4) {
    sprite=sources.opposite.sprites[row*2+col-2];sourceName='four-head-walk-opposite.png';
    right=oppositeHands[row][col-2];left=oppositeLeft[row][col-2];
  } else if(mirrored)sprite=sources.original.sprites[row*4+col-2];
  else if(col>=2&&row===6) {
    sprite=sources.right.sprites[2+col-2];sourceName='four-head-walk-right-views.png';
    right=col===2?[68,250]:[13,252];left=col===2?[268,196]:[199,174];
  } else if(row===5&&col>=2) {
    sprite=sources.right.sprites[col-2];sourceName='four-head-walk-right-views.png';
    right=col===2?[249,196]:[195,160];left=col===2?[48,242]:[14,239];
  } else if(row===7&&col>=2) {
    sprite=sources.right.sprites[4+col-2];sourceName='four-head-walk-right-views.png';
    right=col===2?[40,251]:[25,258];left=col===2?[253,208]:[222,199];
  }
  const ratio=sprite.crop.h/251,bob=[0,.6,0,.4][col];
  const corrected=sourceName!=='four-head-walk-body.png',original=sources.original.sprites[row*4+col];
  let neck=45*ratio;
  if(corrected) {
    const {data,info}=await sharp(sprite.image).raw().toBuffer({resolveWithObject:true});let minimum=Infinity;
    for(let y=Math.round(info.height*.13);y<info.height*.28;y++) {
      let width=0;for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>128)width++;
      if(width<minimum){minimum=width;neck=y;}
    }
  }
  const legScale=.7*Math.min(1/ratio,original.crop.w/sprite.crop.w);
  const pose=await normalizeNeutral(sprite,{headCut:corrected?neck-5*ratio:45*ratio,blendHeight:18*ratio,bodyScale:.7/ratio,
    ...(corrected?{legScale,legFrom:132*ratio,legBlend:50*ratio}:{}),
    knots:[[0,12+bob],...(corrected?[[neck-5*ratio,52+bob],[neck,56+bob],[neck+10*ratio,64+bob]]:
      [[45*ratio,52+bob],[54*ratio,60+bob]]),[100*ratio,94],[132*ratio,112],
      [198*ratio,145],[sprite.crop.h,173]]});
  let points={rightHand:pose.map(right),leftHand:pose.map(left)};
  if(corrected) {
    const oldRatio=original.crop.h/251,reference=await normalizeNeutral(original,{
      headCut:45*oldRatio,blendHeight:18*oldRatio,bodyScale:.7/oldRatio,
      knots:[[0,12+bob],[45*oldRatio,52+bob],[54*oldRatio,60+bob],[100*oldRatio,94],[132*oldRatio,112],
        [198*oldRatio,145],[original.crop.h,173]]});
    const raw=await sharp(pose.image).raw().toBuffer(),head=await sharp(reference.image).raw().toBuffer();
    head.copy(raw,0,0,57*192*4);pose.image=await cellPng(raw);
    for(let y=57;y<64;y++)for(let x=84;x<109;x++) {
      const p=(y*192+x)*4;head.copy(raw,p,p,p+4);
    }
    pose.image=await cellPng(raw);
    pose.recipe.headSource={source:'arena/art/source/four-head-walk-body.png',crop:original.crop,
      retainedTargetRows:[0,56],neckJoin:{rows:[57,63],columns:[84,108]},
      reason:'Keep reviewed head and narrow neck; source-neck registration aligns corrected shoulders below this join.'};
  }
  if(mirrored) {
    const raw=await sharp(pose.image).raw().toBuffer(),result=Buffer.from(raw);
    for(let y=58;y<192;y++)for(let x=0;x<192;x++) {
      const p=(y*192+x)*4,q=(y*192+192-x)*4;
      if(x>0)raw.copy(result,p,q,q+4);else result.fill(0,p,p+4);
    }
    pose.image=await cellPng(result);
    // Only symmetric under-neck body anatomy is reflected; head, garments, hair and staff are not.
    const originalLeft=row===4?[[7,114],[8,128]][col-2]:left;
    const originalRight=[[77,131],[77,130]][col-2];
    const lh=pose.map(originalLeft),rh=pose.map(originalRight);
    points={rightHand:[192-lh[0],lh[1]],leftHand:[192-rh[0],rh[1]]};
    right=originalLeft;left=originalRight;
  }
  if((row===5&&col===3)||(row===7&&col===2)) {
    const direction=row===5?'NE':'SE';
    pose.image=await repairLegs(pose.image,direction);
    pose.recipe.limbRepair={module:'four-head-leg-repair.mjs',direction,
      method:'Generated leg pixels segmented and re-rooted at opposite hip; original feet direction preserved; near/far compositing corrected.',
      status:'candidate pending independent review'};
  }
  if(corrected) {
    if(col===3&&[2,6].includes(row))pose.image=await lowerPassing(pose.image,row===2?'W':'E');
    pose.image=await restoreLegVolume(pose.image,row===2?1.24:row===6?1.24:1.15);
    pose.recipe.balance={sourceNeck:neck,neckTargetY:56+bob,legWidthScale:row===2||row===6?1.24:1.15,
      passingRetarget:col===3&&[2,6].includes(row)?'Hip anchored; articulated thigh/shin lower knee to y134 and ankle145–147, rather than translating the boot.':null};
  }
  return {...pose,sourceName,points,sourceHands:{right,left},recipe:{...pose.recipe,
    bodySource:`arena/art/source/${sourceName}`,correction:mirrored?
      'Symmetric neck-down limb reflection of phase00/01; head and all asymmetric equipment unchanged; anatomical right grip re-registered. Review candidate.':
      sourceName==='four-head-walk-body.png'?'original':'Dedicated opposite-half source pose; review candidate.'}};
}
