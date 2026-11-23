import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
const [configPath, output] = process.argv.slice(2),
  config = JSON.parse(await readFile(configPath)),
  budget = JSON.parse(await readFile(path.join(output, "atlas-budget.json")));
const atlases = {};
for (const layer of budget.layers.filter((l) => l.active)) {
  atlases[layer.layer] = {};
  for (const page of layer.pages) {
    const json = JSON.parse(await readFile(path.join(output, page.json)));
    for (const [name, frame] of Object.entries(json.frames))
      atlases[layer.layer][name] = {
        ...frame,
        image: path.join(output, page.image),
      };
  }
}
const [width, height] = config.cell,
  directions = Object.keys(config.directions),
  count = config.frameCount || config.directions[directions[0]].poses.length,
  looks = config.previewLooks,
  items = [];
for (const [lookIndex, [name, layers]] of Object.entries(looks).entries()) {
  const animation = [];
  for (let frame = 0; frame < count; frame++) {
    const strips = [];
    for (const [row, direction] of directions.entries()) {
      const parts = [];
      for (const layer of (budget.layerOrderByDirection?.[direction] || layers).filter(layer => layers.includes(layer))) {
        if (!atlases[layer]) continue; // Inactive transparent layers have no atlas page.
        const key = `${config.action}/${layer}/${direction}/${String(frame).padStart(2, "0")}`,
          f = atlases[layer][key];
        parts.push({
          input: await sharp(f.image)
            .extract({
              left: f.frame.x,
              top: f.frame.y,
              width: f.frame.w,
              height: f.frame.h,
            })
            .png()
            .toBuffer(),
          left: f.spriteSourceSize.x,
          top: f.spriteSourceSize.y,
        });
      }
      const png = await sharp({
        create: { width, height, channels: 4, background: "#e6e2dc" },
      })
        .composite(parts)
        .png()
        .toBuffer();
      items.push({
        input: png,
        left: frame * width,
        top: (lookIndex * directions.length + row) * height,
      });
      strips.push({ input: png, left: 0, top: row * height });
    }
    animation.push(
      await sharp({
        create: {
          width,
          height: height * directions.length,
          channels: 4,
          background: "#e6e2dc",
        },
      })
        .composite(strips)
        .raw()
        .toBuffer(),
    );
  }
  await sharp(Buffer.concat(animation), {
    raw: {
      width,
      height: height * directions.length * count,
      channels: 4,
      pageHeight: height * directions.length,
    },
  })
    .gif({
      loop: 0,
      delay: config.directions[directions[0]].poses.map((p) => p.durationMs),
    })
    .toFile(path.join(output, `${name}-loop.gif`));
}
await sharp({
  create: {
    width: count * width,
    height: height * directions.length * Object.keys(looks).length,
    channels: 4,
    background: "#e6e2dc",
  },
})
  .composite(items)
  .png()
  .toFile(path.join(output, "looks-contact.png"));
