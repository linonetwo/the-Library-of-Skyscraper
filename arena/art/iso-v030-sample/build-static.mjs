import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const out = new URL('../../client/public/assets/iso-v030-sample/', import.meta.url);
const sourcePath = new URL('source/iso-v030-body-sample.png', root);
const source = await readFile(sourcePath);
const rawSource=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let p=0;p<rawSource.data.length;p+=4)if(rawSource.data[p+3]<=8)rawSource.data.fill(0,p,p+4);
const cleanSource=await sharp(rawSource.data,{raw:rawSource.info}).png().toBuffer();
const prompt = await readFile(new URL('source/iso-v030-body-sample-prompt.txt', root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
await mkdir(out, { recursive: true });

// Hand-registered on the actual generated source, not inferred from alpha bounds.
// The source poses are frozen locomotion poses, NOT an accepted idle/walk clip.
export const poses = [
  {
    direction: 'NE', sourceCell: [0, 0, 384, 512], ground: [186.5, 428],
    crown: [194, 29], chin: [201, 133], neck: [185, 144],
    pelvis: [187, 269],
    joints: {
      leftShoulder: [149, 150], leftElbow: [125, 216], leftWrist: [109, 271],
      rightShoulder: [222, 167], rightElbow: [245, 212], rightWrist: [276, 227],
      leftHip: [172, 285], leftKnee: [155, 365], leftAnkle: [141, 438], leftFoot: [140, 470],
      rightHip: [210, 285], rightKnee: [219, 335], rightAnkle: [233, 368], rightFoot: [231, 385],
    },
    nearArm: [[209,148],[227,151],[245,179],[253,198],[275,207],[291,218],[294,236],[278,248],[256,238],[233,230],[219,209],[208,180]],
    depth: ['right-leg', 'torso', 'left-leg', 'left-arm', 'right-arm'],
    contacts: { leftFoot: 'source-contact-unverified', rightFoot: 'source-contact-unverified' },
  },
  {
    direction: 'SW', sourceCell: [0, 512, 384, 512], ground: [188, 428],
    crown: [188, 33], chin: [168, 147], neck: [181, 159],
    pelvis: [190, 270],
    joints: {
      leftShoulder: [232, 174], leftElbow: [261, 220], leftWrist: [277, 262],
      rightShoulder: [143, 164], rightElbow: [124, 215], rightWrist: [103, 256],
      leftHip: [212, 286], leftKnee: [218, 345], leftAnkle: [237, 374], leftFoot: [236, 386],
      rightHip: [179, 285], rightKnee: [166, 364], rightAnkle: [149, 439], rightFoot: [140, 469],
    },
    nearArm: [[221,153],[240,158],[253,178],[262,197],[281,228],[291,251],[288,271],[278,281],[265,275],[262,257],[248,234],[233,219],[221,188]],
    depth: ['left-leg', 'right-arm', 'torso', 'right-leg', 'left-arm'],
    contacts: { leftFoot: 'source-contact-unverified', rightFoot: 'source-contact-unverified' },
  },
];
export const scale = 0.328125; // Exactly 126/384 == 168/512: no anisotropic whole-body resize.
const inside = (x,y,polygon) => {
  let hit = false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,yi]=polygon[i], [xj,yj]=polygon[j];
    if(((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
};
const layers = { body: [], 'body-front': [] };
const registrations = [];
const previews = [];
for (const pose of poses) {
  const [left, top, width, height] = pose.sourceCell;
  const cellW=width*scale, cellH=height*scale;
  const x=Math.round(96-pose.ground[0]*scale), y=Math.round(172.8-pose.ground[1]*scale);
  const input=await sharp(cleanSource).extract({left,top,width,height}).resize(cellW,cellH).png().toBuffer();
  const {data,info}=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite([{input,left:x,top:y}]).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const fore = Buffer.alloc(data.length);
  const back = Buffer.from(data);
  for(let cy=0;cy<192;cy++) for(let cx=0;cx<192;cx++) {
    if(!inside((cx+.5-x)/scale,(cy+.5-y)/scale,pose.nearArm)) continue;
    const p=(cy*192+cx)*4;
    data.copy(fore,p,p,p+4); back.fill(0,p,p+4);
  }
  for(const [layer,pixels] of [['body',back],['body-front',fore]]) {
    const cell = await sharp(pixels,{raw:info}).png().toBuffer();
    layers[layer].push(cell);
  }
  const composite=await sharp(layers.body.at(-1)).composite([{input:layers['body-front'].at(-1)}]).png().toBuffer();
  previews.push({input:composite,left:previews.length*192,top:0});
  const point=([px,py])=>[x+px*cellW/width,y+py*cellH/height];
  registrations.push({
    direction:pose.direction, sourceCell:pose.sourceCell,
    sourceGroundPivot:pose.ground, groundPivot:[96,172.8], uniformScale:scale,
    placement:[x,y,cellW,cellH], crown:point(pose.crown), chin:point(pose.chin),
    neck:point(pose.neck), pelvis:point(pose.pelvis),
    joints:Object.fromEntries(Object.entries(pose.joints).map(([key,value])=>[key,point(value)])),
    sourceNearArmMask:pose.nearArm, depth:pose.depth, contacts:pose.contacts,
    sourcePoseOnly:true, actionApproved:false,
  });
}
for(const [layer,cells] of Object.entries(layers)) {
  const frames={};
  for(const [index,pose] of poses.entries()) frames[`sample/${layer}/${pose.direction}/00`]={
    frame:{x:index*196+2,y:2,w:192,h:192},rotated:false,trimmed:false,
    spriteSourceSize:{x:0,y:0,w:192,h:192},sourceSize:{w:192,h:192},anchor:{x:.5,y:.9},
  };
  const bytes=await sharp({create:{width:392,height:196,channels:4,background:'#00000000'}})
    .composite(cells.map((input,index)=>({input,left:index*196+2,top:2}))).png().toBuffer();
  await writeFile(new URL(`${layer}.png`,out),bytes);
  await writeFile(new URL(`${layer}.json`,out),json({
    frames,meta:{app:'arena-iso-v030-camera-sample',version:'1',image:`${layer}.png`,format:'RGBA8888',size:{w:392,h:196},scale:'1'},
  }));
}
await sharp({create:{width:384,height:192,channels:4,background:'#d5dfd9'}}).composite(previews).png()
  .toFile(new URL('registered-body-preview.png',import.meta.url).pathname);
await writeFile(new URL('registration.json',out),json({
  schemaVersion:1,status:'camera-prototype',releaseApproved:false,sourcePoseOnly:true,walkApproved:false,
  source:'arena/art/source/iso-v030-body-sample.png',sourceSha256:hash(source),promptSha256:hash(prompt),
  generator:'GPT Image 2 via proxy-imagegen, text-only; one success after one SSE retry',
  alphaNote:'Original has real transparent alpha; hidden RGB is brown but not visible when composited correctly.',
  alphaCleanup:'Alpha <= 8/255 background haze cleared in derived assets only; original source preserved.',
  camera:{projection:'orthographic',yawDegrees:45,elevationDegrees:30,tileSize:[128,64],worldUnitMeters:1,zScale:78.3837},
  anatomy:{heads:4,entityHeightMeters:1.7},cell:[192,192],anchor:[.5,.9],
  frames:registrations,
  pending:['Product renderer ground/contact review','Independent silhouette/foreground-mask review','True opposite-foot walk phases','1 outfit + 1 hairstyle independent attachments'],
}));
console.log(`Built ${poses.length} frozen camera poses, 2 layers; NOT a walk/idle release.`);
