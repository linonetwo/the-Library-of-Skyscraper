import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { art, output } from './idle-pipeline.mjs';

const composed={};
for(const action of ['idle','walk'])for(const outfit of ['scholar','warden'])for(const hair of ['ivory','midnight'])for(const held of [false,true]) {
  const layers=[...(held?['weapon-staff-back']:[]),`hair-${hair}-back`,
    'body',`outfit-${outfit}`,...(held?['weapon-staff-front']:[]),'body-front',
    ...(held?['hand-grip']:[]),`hair-${hair}-front`];
  const inputs=await Promise.all(layers.map(name=>readFile(new URL(`${action}-${name}.png`,output))));
  const image=await sharp({create:{width:784,height:1568,channels:4,background:'#00000000'}})
    .composite(inputs.map(input=>({input}))).png().toBuffer();
  const key=`${action}-${outfit}-${hair}${held?'-staff':''}`;
  await sharp(image).toFile(new URL(`${key}-preview.png`,art).pathname);
  composed[key]=image;
}
for(const outfit of ['scholar','warden'])
  await writeFile(new URL(`walk-${outfit}-staff-preview.png`,art),composed[`walk-${outfit}-ivory-staff`]);
const scholarBase=await Promise.all(['body','outfit-scholar','body-front'].map(layer=>readFile(new URL(`walk-${layer}.png`,output))));
await sharp(scholarBase[0]).composite(scholarBase.slice(1).map(input=>({input}))).png()
  .toFile(new URL('walk-scholar-preview.png',art).pathname);
// Each row: idle-rest, then all four authentic walk phases. Eight rows preserve direction order.
for(const outfit of ['scholar','warden'])for(const hair of ['ivory','midnight']) {
  const composites=[];
  for(let row=0;row<8;row++)for(let col=0;col<5;col++) {
    const action=col===0?'idle':'walk',phase=col===0?0:col-1;
    const image=await sharp(composed[`${action}-${outfit}-${hair}-staff`])
      .extract({left:phase*196+2,top:row*196+2,width:192,height:192}).png().toBuffer();
    composites.push({input:image,left:col*196+2,top:row*196+2});
  }
  await sharp({create:{width:980,height:1568,channels:4,background:'#24363cff'}}).composite(composites).png()
    .toFile(new URL(`idle-walk-${outfit}-${hair}-comparison.png`,art).pathname);
}
console.log('Rendered 16 current action/equipment contact sheets and four idle-to-walk comparison sheets.');
