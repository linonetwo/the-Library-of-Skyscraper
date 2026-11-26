import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadClimbRig, here } from "./rig.mjs";
import { climbInputs, climbPhaseFrames } from "./climb.mjs";
import { registerClimbHands, articulateClimb } from "./climb-hands.mjs";
import { exportPoses } from "../../pose-export.mjs";
import { writeClimbReviewSheets } from "./climb-review.mjs";
import { registerClimbStaffInset } from "./climb-staff.mjs";
const names = (process.argv[2] ?? "NE,SW").split(",");
if (names.some(name => !["NE", "SW", "N", "NW", "W", "E", "SE", "S"].includes(name))) throw Error("Unknown climb direction");
const config = await loadClimbRig(names);
for (const [folder, registeredNames] of [
  ["revised", names.filter(name => name === "NE" || name === "SW")],
  ["six", names.filter(name => name !== "NE" && name !== "SW")],
]) if (registeredNames.length)
  await registerClimbHands(config, path.resolve(here, "../../../iso-v050-mobility/climb-hands", folder, "manifest.json"), registeredNames);
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
  direction.poses = climbInputs(name).map((input, frame) => {
    let pose;
    try { pose = articulateClimb(direction, input); }
    catch (error) { throw new Error(`${name}/${frame}: ${error.message}; candidate not exported`, { cause: error }); }
    for (const side of ["left", "right"]) {
      const gesture = input.contacts[side].gesture;
      const hand = direction.climbHands[side+(gesture === "grab" ? "Grab" : "Brace")];
      const angle = pose.attachmentAngles[`${side}-${gesture}-hand`]*Math.PI/180;
      const offset = hand.localContact.map((v,i)=>v-hand.wristPivot[i]);
      const wrist = pose.jointPositions[side+"Wrist"], target = pose.handContacts[side].target;
      const error = Math.hypot(wrist[0]+offset[0]*Math.cos(angle)-offset[1]*Math.sin(angle)-target[0],
        wrist[1]+offset[0]*Math.sin(angle)+offset[1]*Math.cos(angle)-target[1]);
      if (error > 1e-6) throw Error(`${name}/${frame}/${side}/${gesture}: palm contact error ${error}px; candidate not exported`);
    }
    // Atlas margin only: world XYZ and root travel are not baked into the pose.
    for (const point of Object.values(pose.jointPositions)) { point[0] += 32; point[1] += 32; }
    for (const contact of Object.values(pose.handContacts)) contact.target = contact.target.map(value => value + 32);
    return pose;
  });
}
// Explicit rebuild selection: without the flag the historical A stays intact.
if (process.argv.includes("--ne-staff-inset")) registerClimbStaffInset(config);
const outputName = process.argv[3] ?? "ne-sw-climb";
const out = path.isAbsolute(outputName) ? outputName : path.join(here, "candidates", outputName);
await mkdir(out, { recursive: true });
for (const direction of Object.values(config.directions)) for (const attachment of direction.attachments)
  attachment.image = path.relative(out, attachment.image);
const file = path.join(out, "pose.json");
await writeFile(file, JSON.stringify(config, null, 2) + "\n");
await writeFile(path.join(out, "phase-ranges.json"), JSON.stringify(climbPhaseFrames, null, 2) + "\n");
await exportPoses(file, out);
execFileSync(process.execPath, [path.resolve(here, "../../preview-looks.mjs"), file, out], { stdio: "inherit" });

await writeClimbReviewSheets(out, names.length, Object.keys(config.previewLooks).length, climbPhaseFrames);
