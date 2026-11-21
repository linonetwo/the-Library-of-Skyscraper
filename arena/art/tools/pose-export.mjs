import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frameName } from "../animation-spec.mjs";

export const layers = [
  "body",
  "body-front",
  "outfit-scholar",
  "outfit-warden",
  "hair-ivory",
  "hair-ivory-back",
  "hair-ivory-front",
  "hair-midnight",
  "hair-midnight-back",
  "hair-midnight-front",
  "weapon-staff",
  "weapon-staff-back",
  "weapon-staff-front",
  "hand-grip",
];
import { skeleton, solveLimb } from "./pose-kinematics.mjs";
import { stamp } from "./pose-raster.mjs";
import { packTrimmedLayer } from "./trim-atlas.mjs";
import { applyWorldLegs } from "./world-pose.mjs";
import { auditWorldCycle } from "./world-walk.mjs";
const rotate = ([x, y], a) => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const length = (v) => Math.hypot(...v);
export async function exportPoses(configPath, output) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (!(config.renderScale > 0))
    throw Error("renderScale must declare atlas-to-screen scale");
  const [width, height] = config.cell,
    dirs = Object.entries(config.directions),
    count = dirs[0][1].poses.length;
  if (!count || dirs.some(([, d]) => d.poses.length !== count))
    throw Error("Directions need equal nonzero pose counts");
  await mkdir(output, { recursive: true });
  const layerNames = config.trimAtlases
    ? [...new Set(dirs.flatMap(([, d]) => d.attachments.map((a) => a.layer)))]
    : [
        ...new Set([
          ...layers,
          ...dirs.flatMap(([, d]) => d.attachments.map((a) => a.layer)),
        ]),
      ];
  const cells = Object.fromEntries(layerNames.map((l) => [l, []])),
    contact = [],
    report = [];
  for (const [row, [name, direction]] of dirs.entries()) {
    const attachments = await Promise.all(
      direction.attachments.map(async (a) => {
        const { data, info } = await sharp(
          path.resolve(path.dirname(configPath), a.image),
        )
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        return { ...a, data, width: info.width, height: info.height };
      }),
    );
    let planted = null,
      previous = null;
    for (const [frame, input] of direction.poses.entries()) {
      const pose = structuredClone(input.joints || {}),
        screenDelta = input.rootScreenDelta || [0, 0],
        root = screenDelta.map((v) => v / config.renderScale);
      for (const foot of Object.values(direction.feet || {})) {
        const knee = direction.joints[foot.joint].parent;
        for (const id of [knee, foot.joint])
          if (pose[id]?.offset?.some((v) => v !== 0))
            throw Error(
              `Leg joint offsets are unsupported: ${id}; translate root/hip instead`,
            );
      }
      let state = skeleton(direction.joints, pose, config.groundPivot);
      for (const [side, target] of Object.entries(input.footTargets || {})) {
        state = solveLimb(
          direction,
          pose,
          config.groundPivot,
          direction.feet[side],
          target,
        );
      }
      for (const [joint, target] of Object.entries(input.wristTargets || {})) {
        state = solveLimb(
          direction,
          pose,
          config.groundPivot,
          { joint, bend: target.bend, soleOffset: [0, 0] },
          target.point,
        );
      }
      let projected = null;
      if (input.worldLegPhase !== undefined) {
        projected = applyWorldLegs(
          state,
          direction,
          name,
          input.worldLegPhase,
          config.groundPivot,
          config.worldRegistration,
        );
        state = projected.state;
      }
      const foot = direction.feet?.[input.contactFoot];
      if (foot) {
        if (previous !== input.contactFoot)
          planted = add(
            add(
              state[foot.joint].point,
              rotate(foot.soleOffset || [0, 0], state[foot.joint].angle),
            ),
            root,
          );
        if (!projected)
          state = solveLimb(
            direction,
            pose,
            config.groundPivot,
            foot,
            sub(planted, root),
          );
      } else planted = null;
      previous = input.contactFoot;
      const buffers = Object.fromEntries(
        layerNames.map((l) => [l, Buffer.alloc(width * height * 4)]),
      );
      const sorted = [...attachments].sort(
        (a, b) =>
          (input.depth?.[a.id] ?? a.zOrder ?? 0) -
          (input.depth?.[b.id] ?? b.zOrder ?? 0),
      );
      for (const a of sorted) {
        const joint = state[a.joint];
        stamp(
          buffers[a.layer],
          width,
          height,
          a,
          joint.point,
          a.pivot,
          input.attachmentAngles?.[a.id] !== undefined
            ? (input.attachmentAngles[a.id] * Math.PI) / 180
            : state[a.angleJoint || a.joint].angle +
                ((a.rotation || 0) * Math.PI) / 180,
          projected?.mapping[a.id],
        );
      }
      const composite = [];
      for (const layer of layerNames) {
        const png = await sharp(buffers[layer], {
          raw: { width, height, channels: 4 },
        })
          .png()
          .toBuffer();
        cells[layer].push({
          input: png,
          left: frame * width,
          top: row * height,
        });
        if (config.previewLayers.includes(layer))
          composite.push({ input: png });
      }
      const png = await sharp({
        create: { width, height, channels: 4, background: "#e6e2dc" },
      })
        .composite(composite)
        .png()
        .toBuffer();
      contact.push({ input: png, left: frame * width, top: row * height });
      const actual = foot
        ? add(
            add(
              state[foot.joint].point,
              rotate(foot.soleOffset || [0, 0], state[foot.joint].angle),
            ),
            root,
          )
        : null;
      const gripContacts = attachments
        .filter((a) => a.gripOffset)
        .map((a) => {
          const angle =
            input.attachmentAngles?.[a.id] !== undefined
              ? (input.attachmentAngles[a.id] * Math.PI) / 180
              : state[a.angleJoint || a.joint].angle +
                ((a.rotation || 0) * Math.PI) / 180;
          return {
            id: a.id,
            point: add(state[a.joint].point, rotate(a.gripOffset, angle)),
          };
        });
      report.push({
        direction: name,
        frame,
        durationMs: input.durationMs,
        contactFoot: input.contactFoot || null,
        rootScreenDelta: screenDelta,
        rootAtlasDelta: root,
        plantAtlasWorld: planted,
        actualAtlasWorld: actual,
        errorPx: foot ? length(sub(actual, planted)) : null,
        screenErrorPx: foot
          ? length(sub(actual, planted)) * config.renderScale
          : null,
        wristTargets: Object.fromEntries(
          Object.entries(input.wristTargets || {}).map(([id, target]) => [
            id,
            {
              target: target.point,
              actual: state[id].point,
              errorPx: length(sub(state[id].point, target.point)),
            },
          ]),
        ),
        gripContacts,
        gripErrorPx:
          gripContacts.length === 2
            ? length(sub(gripContacts[0].point, gripContacts[1].point))
            : null,
        worldLegs: projected?.world.legs,
        projectionMappings: projected?.ratios,
        joints: state,
      });
    }
  }
  const atlasBudget = [];
  for (const layer of layerNames) {
    if (config.trimAtlases) {
      atlasBudget.push(
        await packTrimmedLayer(layer, cells[layer], config, output),
      );
      continue;
    }
    const image = `${config.action}-${layer}.png`,
      frames = {},
      animations = {};
    for (const [row, [direction, d]] of dirs.entries())
      for (let i = 0; i < count; i++) {
        const name = frameName(config.action, layer, direction, i);
        frames[name] = {
          frame: { x: i * width, y: row * height, w: width, h: height },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: width, h: height },
          sourceSize: { w: width, h: height },
          anchor: {
            x: config.groundPivot[0] / width,
            y: config.groundPivot[1] / height,
          },
        };
        (animations[`${config.action}/${layer}/${direction}`] ??= []).push(
          name,
        );
      }
    await sharp({
      create: {
        width: count * width,
        height: dirs.length * height,
        channels: 4,
        background: "#00000000",
      },
    })
      .composite(cells[layer])
      .png()
      .toFile(path.join(output, image));
    await writeFile(
      path.join(output, `${config.action}-${layer}.json`),
      JSON.stringify(
        {
          frames,
          animations,
          meta: {
            app: "arena-offline-pose-export",
            version: "1",
            image,
            format: "RGBA8888",
            size: { w: count * width, h: dirs.length * height },
            scale: "1",
          },
        },
        null,
        2,
      ) + "\n",
    );
  }
  if (config.worldRegistration)
    await writeFile(
      path.join(output, "world-cycle-report.json"),
      JSON.stringify(
        {
          approved: false,
          space: "ground world xy, sole z=0 from registered boot footprint",
          directions: dirs.map(([name, d]) =>
            auditWorldCycle(
              name,
              d.feet,
              config.groundPivot,
              config.worldRegistration,
            ),
          ),
        },
        null,
        2,
      ),
    );
  if (config.trimAtlases)
    await writeFile(
      path.join(output, "atlas-budget.json"),
      JSON.stringify(
        {
          appearanceOptions: config.appearanceOptions,
          exclusiveLayerGroups: config.exclusiveLayerGroups,
          renderScale: config.renderScale,
          groundPivot: config.groundPivot,
          sourceSize: config.cell,
          directions: dirs.map(([name]) => name),
          maxPageDimension: 2048,
          activeLayers: atlasBudget.filter((l) => l.active).map((l) => l.layer),
          inactiveLayers: atlasBudget
            .filter((l) => !l.active)
            .map((l) => l.layer),
          layers: atlasBudget,
          decodedBytes: atlasBudget.reduce((sum, l) => sum + l.decodedBytes, 0),
          mipmapMultiplierIfEnabled: 4 / 3,
        },
        null,
        2,
      ),
    );
  await sharp({
    create: {
      width: count * width,
      height: dirs.length * height,
      channels: 4,
      background: "#e6e2dc",
    },
  })
    .composite(contact)
    .png()
    .toFile(path.join(output, "contact-sheet.png"));
  const marks = report
    .map((f, index) => {
      const col = index % count,
        row = Math.floor(index / count),
        x = col * width,
        y = row * height;
      const sole = f.actualAtlasWorld
        ? sub(f.actualAtlasWorld, f.rootAtlasDelta)
        : null;
      const label = `${f.direction} ${f.frame} ${f.contactFoot || "air"} ${f.durationMs}ms`;
      return (
        `<text x="${x + 6}" y="${y + 14}" font-size="11" fill="#182835">${label}</text>` +
        (sole
          ? `<circle cx="${x + sole[0]}" cy="${y + sole[1]}" r="3" fill="none" stroke="#d32430"/>`
          : "")
      );
    })
    .join("");
  await sharp(path.join(output, "contact-sheet.png"))
    .composite([
      {
        input: Buffer.from(
          `<svg width="${count * width}" height="${dirs.length * height}">${marks}</svg>`,
        ),
      },
    ])
    .png()
    .toFile(path.join(output, "contact-debug.png"));
  const activeLayers = [
    ...new Set(dirs.flatMap(([, d]) => d.attachments.map((a) => a.layer))),
  ];
  const skeletonMarks = report
    .map((frame, index) => {
      const x = (index % count) * width,
        y = Math.floor(index / count) * height;
      let lines = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#f4f1eb"/><text x="${x + 4}" y="${y + 14}" font-size="11">${frame.direction} ${frame.frame}</text>`;
      const definitions = config.directions[frame.direction].joints;
      for (const [id, joint] of Object.entries(frame.joints)) {
        const parent = definitions[id].parent;
        if (!parent) continue;
        const start = frame.joints[parent].point,
          end = joint.point;
        const color = id.startsWith("left")
          ? "#1767b1"
          : id.startsWith("right")
            ? "#cd3a27"
            : "#777";
        lines += `<line x1="${start[0] + x}" y1="${start[1] + y}" x2="${end[0] + x}" y2="${end[1] + y}" stroke="${color}" stroke-width="1.3"/><circle cx="${end[0] + x}" cy="${end[1] + y}" r="1.8" fill="${color}"/>`;
      }
      return lines;
    })
    .join("");
  await sharp(
    Buffer.from(
      `<svg width="${count * width}" height="${dirs.length * height}">${skeletonMarks}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(output, "skeleton-debug.png"));
  const loopFrames = [];
  for (let frame = 0; frame < count; frame++)
    loopFrames.push(
      await sharp(path.join(output, "contact-sheet.png"))
        .extract({
          left: frame * width,
          top: 0,
          width,
          height: dirs.length * height,
        })
        .ensureAlpha()
        .raw()
        .toBuffer(),
    );
  await sharp(Buffer.concat(loopFrames), {
    raw: {
      width,
      height: dirs.length * height * count,
      channels: 4,
      pageHeight: dirs.length * height,
    },
  })
    .gif({ loop: 0, delay: dirs[0][1].poses.map((f) => f.durationMs) })
    .toFile(path.join(output, "contact-loop.gif"));
  await writeFile(
    path.join(output, "contact-report.json"),
    JSON.stringify(
      {
        approved: false,
        reviewNotes: config.reviewNotes || [],
        activeLayers,
        inactiveLayers: layers.filter((layer) => !activeLayers.includes(layer)),
        renderScale: config.renderScale,
        cycleWorldStride: config.cycleWorldStride ?? null,
        action: config.action,
        directions: dirs.map(([name]) => name),
        frames: report,
      },
      null,
      2,
    ) + "\n",
  );
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [config, output] = process.argv.slice(2);
  if (!config || !output)
    throw Error("Usage: node pose-export.mjs CONFIG.json OUTPUT_DIRECTORY");
  const report = await exportPoses(path.resolve(config), path.resolve(output));
  const contacts = report.filter((f) => f.contactFoot);
  console.log(
    `Exported ${report.length} poses; ${contacts.length} contact frames; ${contacts.length ? `max plant error ${Math.max(...contacts.map((f) => f.errorPx)).toFixed(6)} atlas px` : "foot lock not exercised"}; art approval pending`,
  );
}
