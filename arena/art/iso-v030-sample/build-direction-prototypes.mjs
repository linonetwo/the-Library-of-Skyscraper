import sharp from 'sharp';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Direction/source prototypes only. Each component is resized isotropically.
// The original 5–6-head generated body is retained unchanged as source.
const output = new URL('./direction-prototypes/', import.meta.url);
await mkdir(output, {recursive: true});
const configs = [
  {direction:'E', file:'ew', region:[0,0,512,512], crown:[266,30], neck:[264,114], ground:[267,488], headBounds:[220,320], neckMask:[108,247,285]},
  {direction:'W', file:'ew', region:[0,512,512,512], crown:[266,541], neck:[264,628], ground:[260,999], headBounds:[215,315], neckMask:[624,245,285]},
  {direction:'N', file:'ns', region:[0,0,512,512], crown:[259,27], neck:[258,110], ground:[257,482], headBounds:[215,303], neckMask:[99,241,277]},
  {direction:'S', file:'ns', region:[0,512,512,512], crown:[260,538], neck:[260,630], ground:[257,999], headBounds:[214,304], neckMask:[614,247,273]},
  {direction:'NW', file:'nwse', region:[0,0,512,512], crown:[282,13], neck:[283,104], ground:[277,494], headBounds:[235,328], neckMask:[94,275,295]},
  {direction:'SE', file:'nwse', region:[0,512,512,512], crown:[283,527], neck:[280,623], ground:[282,1016], headBounds:[235,328], neckMask:[615,270,291]},
];
const groundPivot=[96,172.8];
const targetCrownY=40.8, targetNeckY=78;
const entries={};
const composites=[];
for(const c of configs) {
  const sourceName=`iso-v030-body-${c.file}-neutral.png`;
  const original=await readFile(new URL(`../source/${sourceName}`,import.meta.url));
  const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bodyScale=(groundPivot[1]-targetNeckY)/(c.ground[1]-c.neck[1]);
  const headScale=(targetNeckY-targetCrownY)/(c.neck[1]-c.crown[1]);
  const pieces=[];
  const parts=[];
  for(const part of ['body','head']) {
    const bounds=part==='head'
      ? [c.region[0],c.region[1],c.region[2],c.neck[1]-c.region[1]+3]
      : [c.region[0],c.neck[1]-3,c.region[2],c.region[1]+c.region[3]-c.neck[1]+3];
    const [left,top,width,height]=bounds;
    const local=Buffer.alloc(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const src=((y+top)*info.width+x+left)*4, dst=(y*width+x)*4;
      const sx=x+left,sy=y+top;
      const insideHead=part!=='head'||(sx>=c.headBounds[0]&&sx<=c.headBounds[1]
        &&(sy<c.neckMask[0]||(sx>=c.neckMask[1]&&sx<=c.neckMask[2])));
      if(data[src+3]>8&&insideHead)data.copy(local,dst,src,src+4);
    }
    let x0=width,y0=height,x1=-1,y1=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(local[(y*width+x)*4+3]>8) {
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
    const scale=part==='head'?headScale:bodyScale;
    const scaled=await sharp(local,{raw:{width,height,channels:4}})
      .extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1})
      .resize({width:Math.round((x1-x0+1)*scale)}).png().toBuffer();
    const targetAnchor=part==='head'
      ? [groundPivot[0]+(c.neck[0]-c.ground[0])*bodyScale,targetNeckY]
      : groundPivot;
    const sourceAnchor=part==='head'?c.neck:c.ground;
    const dest=[
      Math.round(targetAnchor[0]-(sourceAnchor[0]-left-x0)*scale),
      Math.round(targetAnchor[1]-(sourceAnchor[1]-top-y0)*scale),
    ];
    // Save real transparent attachments separately, not just a composite figure.
    await writeFile(new URL(`${c.direction}-${part}.png`,output),scaled);
    pieces.push({input:scaled,left:dest[0],top:dest[1]});
    parts.push({id:part,image:`${c.direction}-${part}.png`,sourceRect:[left+x0,top+y0,x1-x0+1,y1-y0+1],scale,
      sourceAnchor,targetAnchor,placement:dest,scaleMode:'isotropic'});
  }
  const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite(pieces).png().toBuffer();
  await writeFile(new URL(`${c.direction}.png`,output),image);
  composites.push({input:image,left:configs.indexOf(c)*192,top:0});
  entries[c.direction]={source:sourceName,sourceSha256:createHash('sha256').update(original).digest('hex'),
    sourceAnatomy:'generated 5–6 heads; component registration prototype',
    cameraApproved:false,releaseApproved:false,canvas:[192,192],groundPivot,
    targetVisibleCrownToGround:132,parts,
    pending:['independent camera/proportion review','separate full limb joint registration','body/body-front partition','outfit/hair attachment alignment']};
}
await sharp({create:{width:1152,height:192,channels:4,background:'#d6dfda'}})
  .composite(composites).png().toFile(new URL('directions-normalized-preview.png',output).pathname);
await writeFile(new URL('registration.json',output),JSON.stringify({
  status:'component-normalization-prototype',renderScale:1,
  originalSourcesPreserved:true,directions:entries
},null,2)+'\n');
