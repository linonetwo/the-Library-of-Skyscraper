import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { directions, frameName } from './animation-spec.mjs';
import { extractSourceSprites } from './source-sprites.mjs';
import { art, output, json, digest, keepPixel, place, packLayer, sourceProvenance } from './idle-pipeline.mjs';
import { cellPng, resample } from './motion-registration.mjs';

const bytes=await readFile(new URL('source/grip-hands.png',art));
const {sprites}=await extractSourceSprites(bytes,{columns:2,rows:4,keepPixel});
const provenance=await sourceProvenance('grip-hands.png','grip-hands-prompt.txt',
  'Eight newly generated anatomical right-hand closed-grip views, independently registered to idle and normalized walk staff grips. Foreground fingers cover the shaft; empty-hand combinations omit this layer.');
for(const action of ['idle','walk']) {
  const staff=JSON.parse(await readFile(new URL(`${action}-weapon-staff.attachments.json`,output),'utf8'));
  const cells=Array.from({length:8},()=>[]),frames=[];
  for(let row=0;row<8;row++)for(let col=0;col<4;col++) {
    const attachment=staff.attachments[row*4+col],sprite=sprites[row];
    const angle=attachment.carryLeanDegrees;
    const base=await sharp(sprite.image).resize(10,15,{fit:'fill'}).png().toBuffer();
    const rotated=await sharp(base).rotate(angle,{background:'#00000000'}).png().toBuffer();
    const meta=await sharp(rotated).metadata(),radians=angle*Math.PI/180;
    // Local grip is at the fist center; the short wrist stays above the clenched fingers.
    const local=[5,9.3],cx=meta.width/2+(local[0]-5)*Math.cos(radians)-(local[1]-7.5)*Math.sin(radians);
    const cy=meta.height/2+(local[0]-5)*Math.sin(radians)+(local[1]-7.5)*Math.cos(radians);
    const p=[Math.round(attachment.grip.x-cx),Math.round(attachment.grip.y-cy),meta.width,meta.height];
    const placed=await place(rotated,p),dx=attachment.grip.x-cx-p[0],dy=attachment.grip.y-cy-p[1];
    const raw=await sharp(placed).raw().toBuffer();
    cells[row].push(await cellPng(resample(raw,(x,y)=>[x-dx,y-dy])));
    frames.push({frame:frameName(action,'hand-grip',directions[row],col),sourceCrop:sprite.crop,
      placement:p,subpixelOffset:[dx,dy],grip:attachment.grip,hand:'right',sourceView:directions[row],rotationDegrees:angle,
      durationMs:action==='idle'?250:125,weaponOnly:true,depth:'above body-front and staff; below hair'});
  }
  const recipe={schemaVersion:1,action,layer:'hand-grip',source:'grip-hands.png',
    sourceSha256:digest(bytes),frames};
  const recipeBytes=Buffer.from(json(recipe));
  await writeFile(new URL(`source/${action}-hand-grip-registration.json`,art),recipeBytes);
  await packLayer('hand-grip',cells,{...provenance,registration:`arena/art/source/${action}-hand-grip-registration.json`,
    recipeSha256:digest(recipeBytes)},action);
  staff.layerOrder=['weapon-staff-back',...(action==='idle'?['hair-back']:[]),'body','outfit',
    'weapon-staff-front','body-front','hand-grip',action==='idle'?'hair-front':'hair'];
  await writeFile(new URL(`${action}-weapon-staff.attachments.json`,output),json(staff));
}
const coveragePath=new URL('coverage.json',output),coverage=JSON.parse(await readFile(coveragePath,'utf8'));
coverage.contentVersion='arena-animation-2026-11-15.motion-grip.1';coverage.generatedOn='2026-11-15';
coverage.auxiliaryLayers=coverage.auxiliaryLayers.filter(e=>e.layer!=='hand-grip');
for(const action of ['idle','walk'])coverage.auxiliaryLayers.push({action,layer:'hand-grip',atlas:`${action}-hand-grip.json`,
  purpose:'Weapon-only closed right-hand fingers over shaft and body-front; direction-specific generated source.'});
coverage.gripSource=provenance;
coverage.review.grip='Dedicated closed right-hand artwork registered to both actions; foreground fingers occlude the shaft. Detailed wrist/shaft contact and all-direction anatomical approval remain prototype review.';
await writeFile(coveragePath,json(coverage));
console.log('Packed idle/walk dedicated closed-grip hand layers, 64 registered cells from eight directional source views.');
