import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadRunJumpRig, here } from "./rig.mjs";
import { runPoses, runStride } from "./run.mjs";
import { jumpPoses } from "./jump.mjs";
import { exportPoses } from "../../pose-export.mjs";
const action = process.argv[2],
  names = (process.argv[3] ?? "NE,SW").split(",");
if (!["run", "jump"].includes(action))
  throw Error("Usage: bake.mjs run|jump NE,SW");
const config = await loadRunJumpRig(names);
config.action = action;
config.playback = action === "run" ? "loop" : "once";
config.frameCount = action === "run" ? 16 : 8;
if (action === "run") config.cycleWorldStride = runStride;
else delete config.cycleWorldStride;
for (const direction of Object.values(config.directions))
  direction.poses = (action === "run" ? runPoses : jumpPoses)(direction);
const out = path.join(
  here,
  "candidates",
  names.join("-").toLowerCase(),
  action,
);
await mkdir(out, { recursive: true });
for (const d of Object.values(config.directions))
  for (const a of d.attachments) a.image = path.relative(out, a.image);
const file = path.join(out, "pose.json");
await writeFile(file, JSON.stringify(config, null, 2) + "\n");
await exportPoses(file, out);
execFileSync(
  process.execPath,
  [path.resolve(here, "../../preview-looks.mjs"), file, out],
  { stdio: "inherit" },
);
