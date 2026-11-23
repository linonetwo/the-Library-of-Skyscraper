import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("./", import.meta.url);
const walk = JSON.parse(await readFile(new URL("walk/pose.json", root)));
for (const action of ["idle", "attack", "hit"]) {
  const config = structuredClone(walk);
  config.action = action;
  config.playback = action === "idle" ? "loop" : "once";
  delete config.cycleWorldStride;
  config.frameCount = action === "hit" ? 2 : 4;
  config.notes.push("Stationary claw strike/recoil candidate; sole world contact fixed.");
  for (const [heading, direction] of Object.entries(config.directions)) {
    direction.attachments.forEach(a => { a.image = `../walk/${a.image}`; });
    const near = "right";
    const shoulder = direction.joints[near + "Shoulder"].cell;
    const rest = direction.joints[near + "Wrist"].cell;
    const sign = heading === "NE" ? 1 : -1;
    const reach = [shoulder[0]+sign*22, shoulder[1]+(sign>0?-3:11)];
    direction.poses = action === "idle"
      ? [0, -0.6, 0, 0.4].map(breath => ({
          durationMs: 250, worldStanding: true, joints: { neck: { offset: [0, breath] } },
        }))
      : action === "attack"
      ? [rest, [shoulder[0]+sign*6, shoulder[1]+11], reach, rest]
        .map((point, i) => ({
          durationMs: [120, 180, 120, 200][i], worldStanding: true,
          joints: { pelvis: {offset:[sign*[0,-1.3,1.8,0][i], [0,1,0.6,0][i]]}, leftShoulder:{rotation:sign*[0,10,-8,0][i]} },
          wristTargets: { [near + "Wrist"]: { point, bend: heading === "NE" ? -1 : 1 } },
        }))
      : [1, 0.3].map((strength, i) => ({
          durationMs: [100, 150][i], worldStanding: true,
          joints: {
            pelvis: { offset: [-sign*2.8*strength, 1.3*strength], rotation: -sign*5.8*strength },
            neck: { rotation: sign*2.2*strength, offset: [0, 0.6*strength] },
            leftShoulder: { rotation: -12*strength },
            rightShoulder: { rotation: 13*strength },
            leftElbow: { rotation: 15*strength },
            rightElbow: { rotation: -17*strength },
          },
        }));
  }
  await mkdir(new URL(`${action}/`, root), { recursive: true });
  await writeFile(new URL(`${action}/pose.json`, root), JSON.stringify(config, null, 2) + "\n");
}
console.log("Enemy attack/hit candidates registered for shared exporter.");
