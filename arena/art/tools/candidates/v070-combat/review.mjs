import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
/** Crop the actual layer-ordered preview; no alternate pose/render path. */
export async function writeDirectionReviews(config,out){
 const names=Object.keys(config.directions),looks=Object.keys(config.previewLooks).length,[width,height]=config.cell,count=config.frameCount;
 await mkdir(path.join(out,'review'),{recursive:true});
 for(let i=0;i<names.length;i++){
  const parts=[];for(let look=0;look<looks;look++)parts.push({input:await sharp(path.join(out,'looks-contact.png')).extract({left:0,top:(look*names.length+i)*height,width:count*width,height}).png().toBuffer(),left:0,top:look*height});
  await sharp({create:{width:count*width,height:looks*height,channels:4,background:'#e6e2dc'}}).composite(parts).png().toFile(path.join(out,'review',names[i]+'.png'));
 }
}
