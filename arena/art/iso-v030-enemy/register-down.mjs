import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { contacts, inside } from "./down/contact-masks.mjs";
const root = new URL("./", import.meta.url);
const source = new URL("source/inkguard-collapse-poses.png", root);
const frames = JSON.parse(await readFile(new URL("down/source-registration.json", root)));
const config = {
  status: "prototype", releaseApproved: false, action: "down", playback: "holdLast",
  source: "source/inkguard-collapse-poses.png",
  sourceSha256: createHash("sha256").update(await readFile(source)).digest("hex"),
  cell: [256, 256], groundPivot: [128, 204.8], renderScale: 1,
  trimAtlases: true, previewLayers: ["body"], frameCount: 4,
  notes: ["Four genuinely painted collapse poses, no standing rotation.",
    "Hood, brace arm and body independently registered from painted floor poses; plum cloth grade preserves bright eyes and metallic edging. Contact-based placement."],
  directions: {},
};
for (const heading of ["NE", "SW"]) {
  const direction = {
    joints: { root: { parent: null, restOffset: [0, 0], cell: config.groundPivot } },
    attachments: [], poses: [],
  };
  await mkdir(new URL(`down/attachments/${heading}/`, root), { recursive: true });
  for (const entry of frames.filter(f => f.heading === heading)) {
    const { crop, scale, frame, image } = entry;
    const width = Math.round(crop.width * scale), height = Math.round(crop.height * scale);
    const [support, contact, delta, hood, arm] = contacts[heading][frame];
    const pivot = contact.map((v,i)=>(v-[crop.left,crop.top][i])*[width/crop.width,height/crop.height][i]-delta[i]);
    const {data,info}=await sharp(source.pathname).extract(crop).resize(width,height).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const names=["body","hood","brace"];
    const parts=names.map(()=>Buffer.alloc(data.length));
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const i=4*(y*width+x), sx=crop.left+(x+.5)*crop.width/width,sy=crop.top+(y+.5)*crop.height/height;
      const part=parts[inside(sx,sy,hood)?1:inside(sx,sy,arm)?2:0];
      const [r,g,b,a]=data.subarray(i,i+4), lum=.30*r+.59*g+.11*b;
      const neutral=Math.min(1,Math.max(0,(38-(Math.max(r,g,b)-Math.min(r,g,b)))/21));
      part[i]=Math.min(255,r*(1-neutral)+(lum*1.12+1)*neutral);
      part[i+1]=g*(1-neutral)+lum*.88*neutral;
      part[i+2]=Math.min(255,b*(1-neutral)+lum*1.025*neutral);part[i+3]=a;
    }
    for(const [i,name] of names.entries()){
      const id=`collapse-${frame}-${name}`, file=image.replace(/\.png$/,`-${name}.png`);
      await sharp(parts[i],{raw:info}).png().toFile(new URL(`down/${file}`,root).pathname);
      direction.attachments.push({id,layer:"body",joint:"root",image:file,pivot,zOrder:i});
    }
    direction.poses.push({
      durationMs: [120, 160, 180, 240][frame], joints: {}, groundSupport:{surface:support,source:contact,screenOffset:delta},
      hiddenAttachments: [0, 1, 2, 3].filter(i => i !== frame).flatMap(i => names.map(name=>`collapse-${i}-${name}`)),
    });
  }
  config.directions[heading] = direction;
}
await writeFile(new URL("down/pose.json", root), JSON.stringify(config, null, 2) + "\n");
console.log("Registered independent collapse silhouettes from preserved source/crop definitions.");
