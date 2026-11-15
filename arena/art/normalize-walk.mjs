import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { directions, frameName } from './animation-spec.mjs';
import { art, output, json, digest, packLayer, place, keepPixel, clearCell } from './idle-pipeline.mjs';
import { extractSourceSprites } from './source-sprites.mjs';
import { cellBytes, cellPng, bounds, registration, mapPoint, normalizeBody, garmentMotion } from './motion-registration.mjs';

const load=name=>readFile(new URL(name,output)), readJson=async name=>JSON.parse(await load(name));
const original=await load('walk-body.png'), idle=await load('idle-body.png'), oldHands=await load('walk-body-front.png');
const oldStaff=await load('walk-weapon-staff.png'), staff=await readJson('walk-weapon-staff.attachments.json');
const cells={}, frames=[], attachments=[], layerFrames={};
for(const layer of ['body','body-front','outfit-scholar','outfit-warden','hair-ivory','hair-midnight','weapon-staff','weapon-staff-front','weapon-staff-back'])
  { cells[layer]=Array.from({length:8},()=>[]);layerFrames[layer]=[]; }
const clothes=Object.fromEntries(await Promise.all(['scholar','warden'].map(async name=>[name,await load(`idle-outfit-${name}.png`)])));
const hair={};
for(const name of ['ivory','midnight']) {
  const bytes=await readFile(new URL(`source/walk-hair-${name}.png`,art));
  hair[name]={ ...await extractSourceSprites(bytes,{columns:4,rows:8,keepPixel:(r,g,b,a)=>keepPixel(r,g,b,a)&&(name!=='ivory'||Math.max(r,g,b)-Math.min(r,g,b)>8)}),
    registration:JSON.parse(await readFile(new URL(`source/idle-hair-${name}-registration.json`,art),'utf8')) };
}
const empty=await clearCell().png().toBuffer();
for(let row=0;row<8;row++)for(let col=0;col<4;col++) {
  const before=await cellBytes(original,row,col),target=await cellBytes(idle,row,0),r=registration(before,target,col);
  const body=normalizeBody(before,r),name=frameName('walk','body',directions[row],col);
  cells.body[row].push(await cellPng(body));
  cells['body-front'][row].push(await cellPng(normalizeBody(await cellBytes(oldHands,row,col),r)));
  for(const layer of ['body','body-front'])layerFrames[layer].push({
    frame:frameName('walk',layer,directions[row],col),originalFrame:frameName('walk',layer,directions[row],col),transform:r});
  const oldGrip=staff.attachments[row*4+col],grip=mapPoint([oldGrip.grip.x,oldGrip.grip.y],r);
  frames.push({frame:name,registration:r,before:{head:bounds(before,0,r.sourceNeck),body:bounds(before)},
    after:{head:bounds(body,0,Math.floor(r.targetNeck)),body:bounds(body)},durationMs:125,
    attachments:{crown:[r.targetHeadCenter,r.targetHead.top+[0,0.6,0,0.6][col]],neck:[96,r.targetNeck],
      hip:[96,128],rightHand:grip},sourcePoseRetained:true});
  for(const outfit of ['scholar','warden']) {
    cells[`outfit-${outfit}`][row].push(await cellPng(garmentMotion(await cellBytes(clothes[outfit],row,0),col,row)));
    layerFrames[`outfit-${outfit}`].push({frame:frameName('walk',`outfit-${outfit}`,directions[row],col),
      sharedSourceFrame:frameName('idle',`outfit-${outfit}`,directions[row],0),
      twist:[-0.8,0.6,0.8,-0.6][col],bob:[0,0.6,0,0.6][col],hemLagFactor:0.55});
  }
  for(const name of ['ivory','midnight']) {
    const p=[...hair[name].registration.frames[row*4].placement];
    p[1]+=[0,1,0,1][col];
    cells[`hair-${name}`][row].push(await place(hair[name].sprites[row*4+col].image,p));
    layerFrames[`hair-${name}`].push({frame:frameName('walk',`hair-${name}`,directions[row],col),
      sourceCrop:hair[name].sprites[row*4+col].crop,placement:p});
  }
  const rawStaff=await cellBytes(oldStaff,row,col),b=bounds(rawStaff),scale=0.53/0.58;
  const piece=await sharp(await cellPng(rawStaff)).extract({left:b.left,top:b.top,width:b.width,height:b.height}).png().toBuffer();
  const w=Math.round(b.width*scale),h=Math.round(b.height*scale);
  const p=[Math.round(grip[0]-(oldGrip.grip.x-b.left)*w/b.width),
    Math.round(grip[1]-(oldGrip.grip.y-b.top)*h/b.height),w,h];
  const weapon=await place(piece,p);
  cells['weapon-staff'][row].push(weapon);
  for(const depth of ['back','front'])cells[`weapon-staff-${depth}`][row].push(oldGrip.depth===depth?weapon:empty);
  attachments.push({...oldGrip,grip:{x:grip[0],y:grip[1]},placement:p,
    originalGrip:oldGrip.grip,normalizationScale:scale});
  for(const layer of ['weapon-staff','weapon-staff-back','weapon-staff-front'])
    layerFrames[layer].push({...attachments.at(-1),frame:frameName('walk',layer,directions[row],col)});
}
const recipe={schemaVersion:1,action:'walk',reference:'idle-body.png',source:'source/walk-body-eight-directions.png',
  sourceAtlasSha256:digest(original),referenceAtlasSha256:digest(idle),frames,
  method:'Piecewise head/torso/leg registration of all 32 original walking poses; planted reference sole y172. Shared standing costume designs with independent walk twist/hem phases.'};
const recipeBytes=Buffer.from(json(recipe));
await writeFile(new URL('source/walk-normalization.json',art),recipeBytes);
await writeFile(new URL('walk-registration.json',output),recipeBytes);
for(const [layer,images]of Object.entries(cells)) {
  let provenance;
  if(layer==='body'||layer==='body-front')provenance={source:'arena/art/source/walk-body-eight-directions.png',
    sourceSha256:digest(await readFile(new URL('source/walk-body-eight-directions.png',art)))};
  else if(layer.startsWith('outfit-')) {
    const p=await readJson(`idle-${layer}.provenance.json`);
    provenance={source:p.source,sourceSha256:p.sourceSha256,promptSha256:p.promptSha256,
      method:'Same generated costume design as idle, independent walk torso twist and hem phases; not a new image generation.'};
  } else {
    const p=await readJson(`walk-${layer.startsWith('weapon')?'weapon-staff':layer}.provenance.json`);
    provenance={source:p.source??`arena/art/source/walk-${layer.startsWith('weapon')?'weapon-staff':layer}.png`,
      sourceSha256:p.sourceSha256,promptSha256:p.promptSha256};
  }
  const layerRecipe=Buffer.from(json({schemaVersion:1,action:'walk',layer,source:provenance.source,
    sourceSha256:provenance.sourceSha256,frames:layerFrames[layer]}));
  const recipePath=`source/walk-${layer}-normalized-registration.json`;
  await writeFile(new URL(recipePath,art),layerRecipe);
  await packLayer(layer,images,{...provenance,normalizationSha256:digest(recipeBytes),recipeSha256:digest(layerRecipe),
    registration:`arena/art/${recipePath}`,review:'Normalized to idle proportions; original four-phase gait retained. All direction/hand contacts require visual approval.'},'walk');
}
await writeFile(new URL('walk-weapon-staff.attachments.json',output),json({...staff,attachments}));
const coverage=await readJson('coverage.json');
coverage.contentVersion='arena-animation-2026-11-15.normalized-walk.1';coverage.generatedOn='2026-11-15';
coverage.review.proportion='Walk head volume/crown and body baseline normalized against measured idle anatomy, preserving the original 32 gait poses. See walk-registration.json for before/after bounds.';
coverage.review.paperDoll='Idle and walk share both costume designs and hair scale. Dedicated directional walk gait and clothing twist remain independent.';
coverage.walkNormalization={registration:'walk-registration.json',sha256:digest(recipeBytes),reference:'idle-body.png'};
for(const entry of coverage.equipmentSources??[])if(entry.layer.startsWith('outfit-')) {
  const source=await readJson(`walk-${entry.layer}.provenance.json`);
  entry.path=source.source;entry.sha256=source.sourceSha256;
}
await writeFile(new URL('coverage.json',output),json(coverage));
console.log('Normalized 32 original walk poses and all dependent layers against idle; recorded measured before/after bounds.');
