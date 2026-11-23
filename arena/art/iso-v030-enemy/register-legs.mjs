import sharp from "sharp";
import { cleanAttachment } from "./clean-attachment.mjs";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("./", import.meta.url);
const neutral = JSON.parse(await readFile(new URL("neutral/pose.json", root)));
const source = await sharp(new URL("source/inkguard-complete-legs.png", root).pathname)
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const zScale = Math.sqrt(6144);
const registration = {
  upper: 0.265, lower: 0.255, hipZ: 0.54, ankleZ: 0.10,
  trackWidth: 0.16, worldSpeed: 1.5, cycleMs: 720, cycleStride: 1.08,
};
const pose = {
  ...neutral, action: "walk", playback: "loop", frameCount: 16,
  source: "source/inkguard-complete-legs.png",
  sourceSha256: createHash("sha256").update(await readFile(new URL("source/inkguard-complete-legs.png", root))).digest("hex"),
  cycleWorldStride: 1.08, worldRegistration: registration,
  notes: ["New complete legs; original hood/torso/cloak/arms preserved.",
    "World leg lengths independently registered for the 1.35world enemy.",
    "All source and target joints are recorded; visual acceptance pending."],
  directions: {},
};
await mkdir(new URL("walk/attachments/", root), { recursive: true });
await cp(new URL("neutral/attachments/", root), new URL("walk/attachments/neutral/", root), { recursive: true });
const reports = [];
for (const [row, heading] of ["NE", "SW"].entries()) {
  const direction = structuredClone(neutral.directions[heading]);
  direction.pending = ["Independent contact-sheet and continuous product review"];
  direction.attachments = direction.attachments
    .filter(a => !a.id.endsWith("-boot"))
    .map(a => ({ ...a, image: a.image.replace("attachments/", "attachments/neutral/") }));
  for (const a of direction.attachments)
    await cleanAttachment(new URL("walk/" + a.image, root).pathname,a.id,heading);
  direction.feet = {};
  for (const [col, side] of ["left", "right"].entries()) {
    const cellWidth = Math.floor(source.info.width / 2);
    const cellHeight = Math.floor(source.info.height / 2);
    let minX = source.info.width, minY = source.info.height, maxX = 0, maxY = 0;
    for (let y = row * cellHeight; y < (row + 1) * cellHeight; y++) {
      for (let x = col * cellWidth; x < (col + 1) * cellWidth; x++) {
        if (source.data[(y * source.info.width + x) * 4 + 3] < 24) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const crop = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    const hipSourceY = 6;
    const soleSourceY = crop.height - 2;
    const scale = (registration.upper + registration.lower + registration.ankleZ) * zScale /
      (soleSourceY - hipSourceY);
    const ankleSourceY = soleSourceY - registration.ankleZ * zScale / scale;
    const kneeSourceY = hipSourceY + registration.upper * zScale / scale;
    function centerAt(localY) {
      const y = minY + Math.round(localY);
      let start = maxX, end = minX;
      for (let x = minX; x <= maxX; x++) {
        if (source.data[(y * source.info.width + x) * 4 + 3] >= 24) {
          start = Math.min(start, x); end = Math.max(end, x);
        }
      }
      return (start + end) / 2 - minX;
    }
    const points = {
      hip: [centerAt(hipSourceY), hipSourceY],
      knee: [centerAt(kneeSourceY), kneeSourceY],
      ankle: [centerAt(ankleSourceY), ankleSourceY],
    };
    const headingSign = heading === "NE" ? -1 : 1;
    const lateralX = (side === "left" ? -1 : 1) * registration.trackWidth / 2 * -headingSign;
    const hip = [96 + 64 * lateralX, 172.8 + 32 * lateralX - zScale * registration.hipZ];
    const knee = hip.map((v, i) => v + (points.knee[i] - points.hip[i]) * scale);
    const ankle = knee.map((v, i) => v + (points.ankle[i] - points.knee[i]) * scale);
    const parent = direction.joints.pelvis.cell;
    for (const [name, point, parentName, parentPoint] of [
      [side + "Hip", hip, "pelvis", parent],
      [side + "Knee", knee, side + "Hip", hip],
      [side + "Ankle", ankle, side + "Knee", knee],
    ]) direction.joints[name] = {
      parent: parentName, cell: point,
      restOffset: point.map((v, i) => v - parentPoint[i]),
    };
    const raw = await sharp(source.data, { raw: source.info }).extract(crop).raw()
      .toBuffer({ resolveWithObject: true });
    const segments = [
      ["thigh", 0, kneeSourceY + 4, "Hip", points.hip],
      ["shin", kneeSourceY - 4, ankleSourceY + 4, "Knee", points.knee],
      ["boot", ankleSourceY - 4, crop.height, "Ankle", points.ankle],
    ];
    await mkdir(new URL(`walk/attachments/${heading}/`, root), { recursive: true });
    for (const [segment, y0, y1, joint, pivot] of segments) {
      const pixels = Buffer.from(raw.data);
      for (let y = 0; y < crop.height; y++) {
        if (y >= y0 && y <= y1) continue;
        for (let x = 0; x < crop.width; x++) pixels[(y * crop.width + x) * 4 + 3] = 0;
      }
      const width = Math.round(crop.width * scale);
      const height = Math.round(crop.height * scale);
      const image = `attachments/${heading}/${side}-${segment}.png`;
      await sharp(pixels, { raw: raw.info }).resize(width, height).png()
        .toFile(new URL("walk/" + image, root).pathname);
      direction.attachments.push({
        id: `${side}-${segment}`, layer: "body", image, joint: side + joint,
        pivot: [pivot[0] * width / crop.width, pivot[1] * height / crop.height],
        zOrder: side === "left" ? -3 : -2,
      });
    }
    direction.feet[side] = {
      joint: side + "Ankle", soleOffset: [0, registration.ankleZ * zScale],
      bend: heading === "NE" ? -1 : 1, contactVerified: false,
    };
    reports.push({ heading, side, crop, scale, sourceJoints: points, registeredJoints: { hip, knee, ankle } });
  }
  direction.poses = Array.from({ length: 16 }, (_, i) => ({
    durationMs: 45, worldLegPhase: i / 16,
    contactFoot: i < 8 ? "left" : "right",
    rootScreenDelta: [4.32 * i * (heading === "NE" ? 1 : -1), 2.16 * i * (heading === "NE" ? -1 : 1)],
    joints: {
      pelvis: { offset: [0, -0.85 * Math.sin(i / 8 * Math.PI) ** 2], rotation: 1.4 * Math.cos(i * Math.PI / 8) },
      neck: { rotation: -0.9 * Math.cos(i * Math.PI / 8) },
      leftShoulder: { rotation: -7 * Math.cos(i * Math.PI / 8) },
      rightShoulder: { rotation: 7 * Math.cos(i * Math.PI / 8) },
    },
  }));
  pose.directions[heading] = direction;
}
await writeFile(new URL("walk/pose.json", root), JSON.stringify(pose, null, 2) + "\n");
await writeFile(new URL("walk/source-registration.json", root), JSON.stringify(reports, null, 2) + "\n");
console.log("Registered complete enemy legs with source/world measurements; visual review pending.");
