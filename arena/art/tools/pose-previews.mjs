import sharp from "sharp";
import path from "node:path";
const sub = (a, b) => a.map((v, i) => v - b[i]);
export async function writePosePreviews({
  config,
  output,
  contact,
  report,
  count,
  dirs,
}) {
  const [width, height] = config.cell;
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
}
