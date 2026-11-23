import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("./", import.meta.url);
const old = new URL("../iso-v030-sample/inkguard-attachments/", root);
const source = JSON.parse(await readFile(new URL("rig.json", old)));
await mkdir(new URL("neutral/", root), { recursive: true });
await cp(fileURLToPath(old), fileURLToPath(new URL("neutral/attachments/", root)), { recursive: true });
const config = {
  ...source, cell: [192, 192], groundPivot: [96, 172.8], renderScale: 1,
  action: "idle", playback: "loop", trimAtlases: true,
  previewLayers: ["body", "body-front"],
  notes: ["Exact original pixels; canvas translation only. No hidden-leg completion or walk acceptance."],
  directions: {},
};
for (const [heading, original] of Object.entries(source.directions)) {
  const direction = structuredClone(original);
  for (const joint of Object.values(direction.joints)) {
    joint.cell = [joint.cell[0] + 32, joint.cell[1] + 28.8];
  }
  direction.attachments.forEach(a => { a.image = `attachments/${a.image}`; });
  direction.poses = [0, -0.6, 0, 0.4].map(breath => ({
    durationMs: 250,
    joints: { neck: { offset: [0, breath] } },
  }));
  config.directions[heading] = direction;
}
await writeFile(new URL("neutral/pose.json", root), JSON.stringify(config, null, 2) + "\n");
console.log("Registered original inkguard pixels at 192/96,172.8.");
