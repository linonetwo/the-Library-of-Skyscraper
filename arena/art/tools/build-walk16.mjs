import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sampleWalk } from "./walk-phases.mjs";
import { exportPoses } from "./pose-export.mjs";

const [input, output] = process.argv.slice(2),
  source = path.resolve(input),
  destination = path.resolve(output);
const config = JSON.parse(await readFile(source, "utf8"));
await mkdir(destination, { recursive: true });
for (const [name, direction] of Object.entries(config.directions)) {
  direction.cycleScreenDelta = (name === "NE" ? [64, -32] : [-64, 32]).map(
    (v) => v * config.cycleWorldStride,
  );
  direction.poses = sampleWalk(
    direction,
    direction.cycleScreenDelta,
    16,
    45,
  ).map((pose, index) => ({
    ...pose,
    footTargets: {},
    worldLegPhase: index / 16,
  }));
  for (const attachment of direction.attachments)
    attachment.image = path.relative(
      destination,
      path.resolve(path.dirname(source), attachment.image),
    );
}
const generated = path.join(destination, "pose-generated.json");
await writeFile(generated, JSON.stringify(config, null, 2));
await exportPoses(generated, destination);
console.log(
  "Exported16x45ms projected world-leg prototype; see world-cycle-report.json and atlas-budget.json; visual approval pending",
);

if (config.previewLooks) {
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    process.execPath,
    [
      new URL("./preview-looks.mjs", import.meta.url).pathname,
      generated,
      destination,
    ],
    { stdio: "inherit" },
  );
}
