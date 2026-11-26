import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadClimbRig, here } from "./rig.mjs";
import { climbInputs, climbPhaseFrames } from "./climb.mjs";
import { registerClimbHands, articulateClimb } from "./climb-hands.mjs";
import { exportPoses } from "../../pose-export.mjs";
const names = (process.argv[2] ?? "NE,SW").split(",");
if (names.some(name => !["NE", "SW"].includes(name))) throw Error("Approve NE/SW complete contact sample before extending headings");
const config = await loadClimbRig(names);
await registerClimbHands(config, path.resolve(here, "../../../iso-v050-mobility/climb-hands/revised/manifest.json"));
config.action = "climb";
config.frameCount = 66;
config.cell = [256, 256];
config.groundPivot = [128, 204.8];
config.playback = "once";
config.phaseFrames = climbPhaseFrames;
delete config.cycleWorldStride;
for (const [look, layers] of Object.entries(config.previewLooks))
  config.previewLooks[look] = [...new Set([...layers.filter(layer => layer !== "hand-grip"), "hand-front"])];
config.previewLayers = config.previewLooks["scholar-ivory-staff"];
for (const [name, direction] of Object.entries(config.directions)) {
  const available = new Set(direction.attachments.map(a => a.layer));
  config.layerOrderByDirection[name] = ["weapon-staff-back", ...config.layerOrderByDirection[name].filter(layer => layer !== "weapon-staff-back")].filter(layer => available.has(layer));
  direction.poses = climbInputs().map(input => {
    const pose = articulateClimb(direction, input);
    // Atlas margin only: world XYZ and root travel are not baked into the pose.
    for (const point of Object.values(pose.jointPositions)) { point[0] += 32; point[1] += 32; }
    for (const contact of Object.values(pose.handContacts)) contact.target = contact.target.map(value => value + 32);
    return pose;
  });
}
const out = path.join(here, "candidates", process.argv[3] ?? "ne-sw-climb");
await mkdir(out, { recursive: true });
for (const direction of Object.values(config.directions)) for (const attachment of direction.attachments)
  attachment.image = path.relative(out, attachment.image);
const file = path.join(out, "pose.json");
await writeFile(file, JSON.stringify(config, null, 2) + "\n");
await writeFile(path.join(out, "phase-ranges.json"), JSON.stringify(climbPhaseFrames, null, 2) + "\n");
await exportPoses(file, out);
execFileSync(process.execPath, [path.resolve(here, "../../preview-looks.mjs"), file, out], { stdio: "inherit" });

// Review sheets crop the same exported pixels; they do not introduce a renderer.
for (const [phase, range] of Object.entries(climbPhaseFrames)) {
  const offsets = range.last-range.first === 24 ? [0,4,8,12,16,20,23,24] : [0,1,2,3,4,5,6,7];
  const parts = [];
  for (let row=0; row<names.length; row++) for (const [column, offset] of offsets.entries())
    parts.push({ input: await sharp(path.join(out, "contact-sheet.png")).extract({left:(range.first+offset)*256,top:row*256,width:256,height:256}).toBuffer(),left:column*256,top:row*256 });
  await sharp({create:{width:8*256,height:names.length*256,channels:4,background:"#e6e2dc"}}).composite(parts).png().toFile(path.join(out, phase+"-sample.png"));
}
