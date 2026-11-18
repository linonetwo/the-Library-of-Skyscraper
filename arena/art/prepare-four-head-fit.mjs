import sharp from 'sharp';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { directions } from './animation-spec.mjs';
import { extractSourceSprites } from './source-sprites.mjs';
import { art,place,keepPixel,json,digest,clearCell } from './idle-pipeline.mjs';
import { normalizeNeutral,frontArms } from './four-head-registration.mjs';
import { sourceGripTracks,staffDepth } from './staff-registration.mjs';
import { approvedMetadata } from './art-approval.mjs';

const root=new URL('four-head-fit/',art);await mkdir(root,{recursive:true});
const read=name=>readFile(new URL(`source/${name}`,art));
const extract=async(name,columns,rows)=>extractSourceSprites(await read(name),{columns,rows,keepPixel});
const bodies=await extract('four-head-neutral.png',2,4),clothes=await extract('four-head-outfits.png',2,8);
const hairs={ivory:await extract('walk-hair-ivory.png',4,8),midnight:await extract('walk-hair-midnight.png',4,8)};
const staves=await extract('walk-weapon-staff.png',4,8),grips=await extract('grip-hands.png',2,4);
const garmentPlacements=[[77,55,38,62],[78,55,36,62],[85,55,25,62],[79,55,35,62],
  [77,55,38,62],[78,55,36,62],[82,55,25,62],[78,55,36,62]];
const handCenters=[[12,213],[13,213],[42,214],[88,214],[100,213],[81,213],[31,214],[12,213]];
const records=[],sheets={};
for(let row=0;row<8;row++) {
  const direction=directions[row],neutral=await normalizeNeutral(bodies.sprites[row]),layers={body:neutral.image};
  layers['body-front']=await frontArms(neutral.image);
  for(const [index,outfit] of ['scholar','warden'].entries()) {
    const p=[...garmentPlacements[row]];if(index===1){p[0]-=3;p[2]+=6;}
    layers[`outfit-${outfit}`]=await place(clothes.sprites[row*2+index].image,p);
  }
  for(const hair of ['ivory','midnight']) {
    const width=hair==='ivory'?46:49,p=[Math.round(96-width/2),7,width,43];
    layers[`hair-${hair}`]=await place(hairs[hair].sprites[row*4].image,p);
    const {data,info}=await sharp(layers[`hair-${hair}`]).raw().toBuffer({resolveWithObject:true}),back=Buffer.alloc(data.length),front=Buffer.from(data);
    for(let y=39;y<192;y++)for(let x=0;x<192;x++)if(x<84||x>108) {
      const offset=(y*192+x)*4;data.copy(back,offset,offset,offset+4);front.fill(0,offset,offset+4);
    }
    for(const [depth,raw] of [['back',back],['front',front]])
      layers[`hair-${hair}-${depth}`]=await sharp(raw,{raw:info}).png().toBuffer();
  }
  const hand=neutral.map(handCenters[row]),sprite=staves.sprites[row*4],{crop}=sprite;
  const [gx,gy]=sourceGripTracks[row][0],local=[gx-crop.x,gy-(crop.y-Math.round(row*staves.sourceSize[1]/8))];
  const scale=.48,w=Math.round(crop.w*scale),h=Math.round(crop.h*scale);
  const staffPlacement=[Math.round(hand[0]-local[0]*w/crop.w),Math.round(hand[1]-local[1]*h/crop.h),w,h];
  layers['weapon-staff']=await place(sprite.image,staffPlacement);
  const empty=await clearCell().png().toBuffer();
  for(const depth of ['front','back'])layers[`weapon-staff-${depth}`]=staffDepth[row]===depth?layers['weapon-staff']:empty;
  layers['hand-grip']=await place(grips.sprites[row].image,[Math.round(hand[0]-3.5),Math.round(hand[1]-6.2),7,10]);
  for(const [layer,bytes] of Object.entries(layers))await writeFile(new URL(`${direction}-${layer}.png`,root),bytes);
  records.push({direction,...neutral.recipe,attachments:{crown:[96,12],neck:[96,56],hip:[96,112],rightHand:hand,
    leftHand:neutral.map([bodies.sprites[row].crop.w-handCenters[row][0],handCenters[row][1]])},
    outfitPlacement:garmentPlacements[row],staffPlacement,staffDepth:staffDepth[row],sourceHandCenter:handCenters[row]});
  for(const outfit of ['scholar','warden'])for(const hair of ['ivory','midnight'])for(const held of [false,true]) {
    const key=`${outfit}-${hair}${held?'-staff':''}`,order=[...(held?['weapon-staff-back']:[]),`hair-${hair}-back`,
      'body',`outfit-${outfit}`,...(held?['weapon-staff-front']:[]),'body-front',...(held?['hand-grip']:[]),`hair-${hair}-front`];
    const image=await clearCell().composite(order.map(name=>({input:layers[name]}))).png().toBuffer();
    sheets[key]??=[];sheets[key].push({input:image,left:(row%4)*196+2,top:Math.floor(row/4)*196+2});
  }
}
for(const [key,composites] of Object.entries(sheets))
  await sharp({create:{width:784,height:392,channels:4,background:'#24363cff'}}).composite(composites).png()
    .toFile(new URL(`${key}.png`,root).pathname);
await writeFile(new URL('registration.json',root),json({schemaVersion:1,...approvedMetadata,
  bodySourceSha256:digest(await read('four-head-neutral.png')),garmentSourceSha256:digest(await read('four-head-outfits.png')),
  directionOrder:directions,frames:records,review:'Reviewed neutral fit underlying approved v0.2.0 idle/walk; later action expansion is outside this approval.'}));
console.log('Built approved eight-direction four-head neutral layered fit and eight outfit/hair/weapon contact sheets.');
