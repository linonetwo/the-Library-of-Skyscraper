import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),out=new URL('assets/',root),review=new URL('review/',root);
await mkdir(out,{recursive:true});await mkdir(review,{recursive:true});
const sourceBytes=await readFile(new URL('source/warehouse-tower.png',root));
const {data,info}=await sharp(sourceBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const canvas=[160,256],pivot=[80,224],mountZ=.5,zScale=78.3837;
const assets={},images={};
const warehouseOutline=[[405,315],[716,453],[725,471],[725,744],[737,752],[737,784],[414,934],[98,786],[98,755],[110,745],[110,526],[106,513],[106,470],[119,455],[214,410],[212,404],[284,370],[299,360],[354,336]];
const towerOutline=[[1201,82],[1239,83],[1274,104],[1295,133],[1304,173],[1298,207],[1285,230],[1257,248],[1259,270],[1248,292],[1227,312],[1242,325],[1245,334],[1287,347],[1288,378],[1271,386],[1270,443],[1277,447],[1275,471],[1263,480],[1262,786],[1283,796],[1295,805],[1333,811],[1334,842],[1133,925],[940,839],[940,811],[982,793],[997,781],[1007,483],[995,472],[996,449],[1003,443],[1004,386],[984,379],[983,348],[1011,333],[1021,339],[1033,325],[1036,310],[1052,294],[1041,272],[1035,250],[1036,223],[1047,191],[1064,168],[1078,153],[1077,149],[1090,143],[1107,145],[1116,141],[1121,150],[1159,104],[1184,87]];
const towerHoles=[
  [[1058,230],[1068,205],[1086,184],[1105,165],[1124,153],[1111,188],[1105,219],[1092,240],[1077,232]],
  [[1127,278],[1150,282],[1194,270],[1225,257],[1218,280],[1196,298],[1170,301],[1140,292]],
];
function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function sample(x,y,c){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const at=(xx,yy)=>data[(Math.max(0,Math.min(info.height-1,yy))*info.width+Math.max(0,Math.min(info.width-1,xx)))*4+c];
  return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
async function make(id,outline,holes,ground,width,height,sourceAttachments,extra){
  const [left,right,front]=ground,cx=(left[0]+right[0])/2,cy=(left[1]+right[1])/2;
  const scaleX=width/(right[0]-left[0]),scaleY=(width/4)/(front[1]-cy);
  const shearX=-scaleX*(front[0]-cx)/(front[1]-cy);
  const transform=([x,y])=>[pivot[0]+scaleX*(x-cx)+shearX*(y-cy),pivot[1]-mountZ*zScale+scaleY*(y-cy)];
  const s=4,w=canvas[0]*s,h=canvas[1]*s,pixels=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const sy=((y+.5)/s-pivot[1]+mountZ*zScale)/scaleY+cy;
    const sx=((x+.5)/s-pivot[0]-shearX*(sy-cy))/scaleX+cx;
    if(!inside(sx,sy,outline)||holes.some(poly=>inside(sx,sy,poly)))continue;
    const at=(y*w+x)*4;for(let c=0;c<3;c++)pixels[at+c]=sample(sx,sy,c);pixels[at+3]=255;
  }
  const raw=await sharp(pixels,{raw:{width:w,height:h,channels:4}}).resize(...canvas).raw().toBuffer();
  for(let i=0;i<raw.length;i+=4)if(raw[i+3]<3)raw.fill(0,i,i+4);
  images[id]=await sharp(raw,{raw:{width:canvas[0],height:canvas[1],channels:4}}).png().toBuffer();
  await writeFile(new URL(`${id}.png`,out),images[id]);
  const attachments=Object.fromEntries(Object.entries(sourceAttachments).map(([key,p])=>{
    const at=transform(p);return[key,{source:p,canvas:at,offsetScreen:[at[0]-pivot[0],at[1]-pivot[1]]}];
  }));
  assets[id]={image:`${id}.png`,canvas,pivot,groundPivot:pivot,anchor:pivot.map((n,i)=>n/canvas[i]),renderScale:1,
    footprint:[1,1],upperMountFootprint:[width/128,width/128],mountHeightMeters:mountZ,heightMeters:height,
    decorationOccupation:{width:1,depth:1,collision:false},kind:'building-upper',layer:'after-plinth-before-construction-front',
    status:'prototype',releaseApproved:false,source:'source/warehouse-tower.png',
    sourceTransform:{type:'ground-triangle-affine-baked',sourceGround:ground,scaleX,scaleY,shearX,sourceCentre:[cx,cy],outline,holes},
    attachments,...extra};
}
await make('warehouse-upper',warehouseOutline,[],[[98,782],[737,782],[414,934]],108.8,1.23,
  {receiving:[[238,662]][0],hitAnchor:[566,675]}, {buildingKind:'warehouse',localBuildOffset:[1.5,-1],visualPurpose:'broad walnut archive receiving cabinet, not teal core'});
await make('tower-upper',towerOutline,towerHoles,[[940,822],[1334,822],[1133,925]],64,1.97,
  {muzzle:[1236,166],hitAnchor:[1195,614]}, {buildingKind:'tower',localBuildOffset:[1.5,1],visualPurpose:'brass lens emitter and shield-faced column',fixedView:true});
// Turn attachment pixel registration into an explicit world-space presentation offset.
for(const a of Object.values(assets))for(const [key,p]of Object.entries(a.attachments)){
  const [sx,sy]=p.offsetScreen;
  // The emitter faces -world-y; other anchors lie on the visible +world-x face.
  const x=key==='muzzle'?0:sx/64,y=key==='muzzle'?-sx/64:0;
  p.worldOffset=[x,y,(32*(x+y)-sy)/zScale];
}
const base=await readFile(new URL('../../client/public/assets/tiles/plinth.png',root));
const core=await sharp({create:{width:canvas[0],height:canvas[1],channels:4,background:'#00000000'}}).composite([{input:base,left:16,top:64}]).png().toBuffer();
const assembled={core};
for(const id of Object.keys(assets))assembled[id]=await sharp(core).composite([{input:images[id],left:0,top:0}]).png().toBuffer();
const frames={},parts=[];let x=2;
for(const[id,a]of Object.entries(assets)){parts.push({input:images[id],left:x,top:2});frames[id]={frame:{x,y:2,w:canvas[0],h:canvas[1]},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:canvas[0],h:canvas[1]},sourceSize:{w:canvas[0],h:canvas[1]},anchor:{x:a.anchor[0],y:a.anchor[1]}};x+=canvas[0]+4;}
await sharp({create:{width:x,height:260,channels:4,background:'#00000000'}}).composite(parts).png().toFile(new URL('buildings-atlas.png',out).pathname);
await writeFile(new URL('buildings-atlas.json',out),JSON.stringify({frames,meta:{image:'buildings-atlas.png',format:'RGBA8888',size:{w:x,h:260},scale:'1'}},null,2)+'\n');
const manifest={schemaVersion:1,status:'prototype',releaseApproved:false,camera:{yaw:45,elevation:30,tileSize:[128,64],zScale,worldUnitMeters:1},
 sources:{'source/warehouse-tower.png':{sha256:createHash('sha256').update(sourceBytes).digest('hex'),size:[info.width,info.height]}},
 reuse:{base:{image:'tiles/plinth.png',canvas:[128,192],pivot:[64,160],renderScale:1,sha256:createHash('sha256').update(base).digest('hex')},catalog:'tiles/lectern.png',construction:['iso-v030-world/construction-site-back.png','iso-v030-world/construction-site-front.png']},
 assets,review:{sourceInspected:true,offlineCompositionInspected:false,clientIntegrated:false,releaseApproved:false}};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
const svg=(w,h,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:sans-serif;fill:#e5e7d7;font-size:16px}</style>${body}</svg>`);
const previews=[];let labels='';
for(const[i,[id,image]]of Object.entries(assembled).entries()){
  const left=40+i*360;previews.push({input:await sharp(image).resize(320,512).png().toBuffer(),left,top:45});
  labels+=`<text x="${left}" y="30">${id==='core'?'Existing core (unchanged)':id+' + existing plinth'}</text>`;
}
labels+='<text x="40" y="590">2x visual review · ground pivot (80,224) · all runtime scale 1 · PROTOTYPE, NOT RELEASE-APPROVED</text>';
await sharp({create:{width:1120,height:620,channels:4,background:'#203537'}}).composite([...previews,{input:svg(1120,620,labels),left:0,top:0}]).png().toFile(new URL('core-warehouse-tower.png',review).pathname);
let guides='';const contacts=[];
for(const[i,[id,a]]of Object.entries(assets).entries()){
  const left=60+i*420;contacts.push({input:await sharp(images[id]).resize(320,512).png().toBuffer(),left,top:40});
  guides+=`<text x="${left}" y="28">${id} · ground 1×1 reservation</text><circle cx="${left+pivot[0]*2}" cy="${40+pivot[1]*2}" r="5" fill="none" stroke="#8bd5ba"/>`;
  for(const[key,p]of Object.entries(a.attachments)){const x=left+p.canvas[0]*2,y=40+p.canvas[1]*2;guides+=`<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#e5ba68"/><text x="${x+8}" y="${y}">${key}</text>`;}
}
await sharp({create:{width:900,height:570,channels:4,background:'#203537'}}).composite([...contacts,{input:svg(900,570,guides),left:0,top:0}]).png().toFile(new URL('contact-registration.png',review).pathname);
console.log('Built warehouse/tower upper PNGs, atlas, source transforms and attachment registrations.');
