import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { art,sourceProvenance,keepPixel } from './idle-pipeline.mjs';
import { extractSourceSprites } from './source-sprites.mjs';
import { directions,frameName } from './animation-spec.mjs';
import { resample,cellPng } from './motion-registration.mjs';
import { frontArms } from './four-head-registration.mjs';

export const dollLayers=['body','body-front','outfit-scholar','outfit-warden',
  'hair-ivory','hair-ivory-back','hair-ivory-front','hair-midnight','hair-midnight-back','hair-midnight-front',
  'weapon-staff','weapon-staff-back','weapon-staff-front','hand-grip'];
export const layerOrder=['weapon-staff-back','hair-back','body','outfit','weapon-staff-front','body-front','hand-grip','hair-front'];
const lifts=[0,-.65,-1.1,-.4],sways=[0,.4,0,-.4];
export const idlePoint=([x,y],col)=>[x,y+lifts[col]*Math.max(0,Math.min(1,(112-y)/56))];
export async function idleDeform(image,col,kind) {
  const raw=await sharp(image).ensureAlpha().raw().toBuffer();
  return cellPng(resample(raw,(x,y)=>{
    const upper=Math.max(0,Math.min(1,(112-y)/56)),sy=y-lifts[col]*upper;
    const tail=kind.startsWith('hair')?Math.max(0,(y-28)/40):kind.startsWith('outfit')?Math.max(0,(y-80)/40):0;
    return [x-sways[col]*tail,sy];
  }));
}
export async function idleFrames() {
  const fit=JSON.parse(await readFile(new URL('four-head-fit/registration.json',art))),cells={},recipes={},frames=[];
  const sources={};
  for(const [name,columns,rows] of [['four-head-outfits.png',2,8],['walk-hair-ivory.png',4,8],
    ['walk-hair-midnight.png',4,8],['walk-weapon-staff.png',4,8],['grip-hands.png',2,4]])
    sources[name]=await extractSourceSprites(await readFile(new URL(`source/${name}`,art)),{columns,rows,keepPixel});
  const bodyProv=await sourceProvenance('four-head-neutral.png','four-head-neutral-prompt.txt',
    'Dedicated standing source, reviewed four-head neutral anatomy registration, upper-body breath with unchanged feet.');
  const clothesProv=await sourceProvenance('four-head-outfits.png','four-head-outfits-prompt.txt',
    'Independent neutral garment views, reviewed fit with four-head anatomy, shoulder breath and delayed hem flutter.');
  const provenance={body:bodyProv,'body-front':bodyProv,'outfit-scholar':clothesProv,'outfit-warden':clothesProv};
  for(const name of ['ivory','midnight'])for(const suffix of ['','-back','-front'])
    provenance[`hair-${name}${suffix}`]=await sourceProvenance(`walk-hair-${name}.png`,`walk-hair-${name}-prompt.txt`,
      'Existing dedicated directional hairstyle design, four-head crown registration, breathing and tip lag; split masks.');
  for(const suffix of ['','-back','-front'])provenance[`weapon-staff${suffix}`]=await sourceProvenance(
    'walk-weapon-staff.png','walk-weapon-staff-prompt.txt','Existing dedicated directional staff design, four-head hand registration.');
  provenance['hand-grip']=await sourceProvenance('grip-hands.png','grip-hands-prompt.txt','Closed fingers over registered shaft, weapon-only.');
  for(const layer of dollLayers){cells[layer]=[];recipes[layer]=[];}
  const attachments=[];
  for(let row=0;row<8;row++) {
    const base={};
    for(const layer of dollLayers) {
      base[layer]=await readFile(new URL(`four-head-fit/${directions[row]}-${layer}.png`,art));
      cells[layer][row]=[];
    }
    for(let col=0;col<4;col++) {
      const register=fit.frames[row],points=Object.fromEntries(Object.entries(register.attachments).map(([key,value])=>[key,idlePoint(value,col)]));
      const entry={frame:frameName('idle','body',directions[row],col),...register,attachments:points,durationMs:250,
        deformation:{lift:lifts[col],hemSway:sways[col],lowerBodyFixedFromY:112},sourcePoseRetained:true};
      frames.push(entry);
      for(const layer of dollLayers) {
        let image;
        if(layer==='body-front')image=await frontArms(cells.body[row][col]);
        else if(layer.startsWith('hair-')&&(layer.endsWith('-front')||layer.endsWith('-back'))) {
          const name=layer.replace(/-(front|back)$/,''),front=layer.endsWith('-front');
          const {data,info}=await sharp(cells[name][row][col]).raw().toBuffer({resolveWithObject:true});
          for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
            const back=y>=39+Math.round(lifts[col])&&(x<84||x>108);
            if(back===front)data.fill(0,(y*192+x)*4,(y*192+x)*4+4);
          }
          image=await sharp(data,{raw:info}).png().toBuffer();
        } else image=await idleDeform(base[layer],col,layer);
        cells[layer][row].push(image);
        const sourceName=provenance[layer].source.split('/').at(-1),sourceIndex=layer.startsWith('outfit')?
          row*2+(layer.endsWith('warden')?1:0):layer==='hand-grip'?row:row*4;
        const extra=layer.startsWith('body')?{}:{sourceCrop:sources[sourceName].sprites[sourceIndex].crop};
        if(layer.startsWith('outfit'))extra.placement=[register.outfitPlacement[0]-(layer.endsWith('warden')?3:0),
          register.outfitPlacement[1],register.outfitPlacement[2]+(layer.endsWith('warden')?6:0),register.outfitPlacement[3]];
        if(layer.startsWith('hair')){const width=layer.includes('ivory')?46:49;extra.placement=[Math.round(96-width/2),7,width,43];}
        if(layer.startsWith('weapon'))extra.placement=register.staffPlacement;
        if(layer==='hand-grip')extra.placement=[Math.round(register.attachments.rightHand[0]-3.5),Math.round(register.attachments.rightHand[1]-6.2),7,10];
        recipes[layer].push({frame:frameName('idle',layer,directions[row],col),bodyFrame:entry.frame,
          durationMs:250,sourceCrop:register.sourceCrop,deformation:entry.deformation,...extra});
      }
      attachments.push({frame:frameName('idle','weapon-staff',directions[row],col),hand:'right',
        grip:{x:points.rightHand[0],y:points.rightHand[1]},carryLeanDegrees:0,depth:register.staffDepth,
        placement:register.staffPlacement,durationMs:250});
    }
  }
  return {action:'idle',cells,recipes,frames,attachments,provenance};
}
