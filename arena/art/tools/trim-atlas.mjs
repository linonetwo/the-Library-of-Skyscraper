import sharp from "sharp";
import { writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { frameName } from "../animation-spec.mjs";

export async function packTrimmedLayer(layer, cells, config, output) {
  const [width, height] = config.cell,
    directions = Object.keys(config.directions),
    count = config.directions[directions[0]].poses.length;
  const sprites = [];
  let pixels = 0,
    nonempty = 0;
  for (const [index, cell] of cells.entries()) {
    const { data, info } = await sharp(cell.input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let x0 = width,
      y0 = height,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * info.width + x) * 4 + 3]) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    const empty = x1 < 0,
      w = empty ? 1 : x1 - x0 + 1,
      h = empty ? 1 : y1 - y0 + 1;
    if (!empty) {
      nonempty++;
      pixels += w * h;
    }
    sprites.push({
      name: frameName(
        config.action,
        layer,
        directions[Math.floor(index / count)],
        index % count,
      ),
      direction: directions[Math.floor(index / count)],
      empty,
      x: empty ? 0 : x0,
      y: empty ? 0 : y0,
      w,
      h,
      input: empty
        ? null
        : await sharp(cell.input)
            .extract({ left: x0, top: y0, width: w, height: h })
            .extend({
              top: 2,
              bottom: 2,
              left: 2,
              right: 2,
              extendWith: "copy",
            })
            .png()
            .toBuffer(),
    });
  }
  if (!nonempty)
    return {
      layer,
      active: false,
      sourceFrames: sprites.length,
      nonemptyFrames: 0,
      pages: [],
      decodedBytes: 0,
    };
  const pages = [];
  const newPage = () => {
    const page = { x: 5, y: 0, rowHeight: 5, width: 5, height: 5, sprites: [] };
    pages.push(page);
    return page;
  };
  let page = newPage();
  for (const sprite of [...sprites]
    .filter((s) => !s.empty)
    .sort((a, b) => b.h - a.h)) {
    const w = sprite.w + 4,
      h = sprite.h + 4;
    if (page.x + w > 2048) {
      page.x = 0;
      page.y += page.rowHeight;
      page.rowHeight = 0;
    }
    if (page.y + h > 2048) page = newPage();
    sprite.page = pages.length - 1;
    sprite.atlasX = page.x + 2;
    sprite.atlasY = page.y + 2;
    page.sprites.push(sprite);
    page.x += w;
    page.rowHeight = Math.max(page.rowHeight, h);
    page.width = Math.max(page.width, page.x);
    page.height = Math.max(page.height, page.y + h);
  }
  for (const sprite of sprites.filter((s) => s.empty)) {
    sprite.page = 0;
    sprite.atlasX = 2;
    sprite.atlasY = 2;
    pages[0].sprites.push(sprite);
  }
  const filenames = pages.map((_, i) => `${config.action}-${layer}-${i}.json`),
    budget = [];
  for (const [index, p] of pages.entries()) {
    const image = `${config.action}-${layer}-${index}.png`,
      frames = {},
      animations = {};
    for (const s of p.sprites) {
      frames[s.name] = {
        frame: { x: s.atlasX, y: s.atlasY, w: s.w, h: s.h },
        rotated: false,
        trimmed: s.w !== width || s.h !== height || s.x !== 0 || s.y !== 0,
        spriteSourceSize: { x: s.x, y: s.y, w: s.w, h: s.h },
        sourceSize: { w: width, h: height },
        anchor: {
          x: config.groundPivot[0] / width,
          y: config.groundPivot[1] / height,
        },
      };
    }
    for (const direction of directions) {
      const names = sprites
        .filter((s) => s.direction === direction && s.page === index)
        .map((s) => s.name);
      if (names.length)
        animations[`${config.action}/${layer}/${direction}`] = names;
    }
    await sharp({
      create: {
        width: p.width,
        height: p.height,
        channels: 4,
        background: "#00000000",
      },
    })
      .composite(
        p.sprites
          .filter((s) => !s.empty)
          .map((s) => ({
            input: s.input,
            left: s.atlasX - 2,
            top: s.atlasY - 2,
          })),
      )
      .png()
      .toFile(path.join(output, image));
    await writeFile(
      path.join(output, filenames[index]),
      JSON.stringify(
        {
          frames,
          animations,
          meta: {
            app: "arena-trimmed-pose-atlas",
            version: "1",
            image,
            format: "RGBA8888",
            size: { w: p.width, h: p.height },
            scale: "1",
            related_multi_packs: filenames.filter((_, i) => i !== index),
          },
        },
        null,
        2,
      ) + "\n",
    );
    budget.push({
      image,
      json: filenames[index],
      width: p.width,
      height: p.height,
      decodedBytes: p.width * p.height * 4,
      pngBytes: (await stat(path.join(output, image))).size,
    });
  }
  return {
    layer,
    active: true,
    sourceFrames: sprites.length,
    nonemptyFrames: nonempty,
    untrimmedPixels: sprites.length * width * height,
    trimmedPixels: pixels,
    pages: budget,
    decodedBytes: budget.reduce((s, p) => s + p.decodedBytes, 0),
  };
}
