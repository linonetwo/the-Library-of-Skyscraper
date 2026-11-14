import sharp from 'sharp';

export async function extractSourceSprites(bytes, { columns, rows, keepPixel }) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (!keepPixel(...data.subarray(i, i + 4))) data[i + 3] = 0;
  }
  const sprites = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const left = Math.round(col * info.width / columns), top = Math.round(row * info.height / rows);
    const width = Math.round((col + 1) * info.width / columns) - left;
    const height = Math.round((row + 1) * info.height / rows) - top;
    const visited = new Uint8Array(width * height);
    let component = [];
    for (let p = 0; p < visited.length; p++) {
      const imageIndex = ((top + Math.floor(p / width)) * info.width + left + p % width) * 4;
      if (visited[p] || data[imageIndex + 3] === 0) continue;
      const queue = [p]; visited[p] = 1;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const q = queue[cursor], x = q % width, y = Math.floor(q / width);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const n = ny * width + nx, offset = ((top + ny) * info.width + left + nx) * 4;
          if (!visited[n] && data[offset + 3]) { visited[n] = 1; queue.push(n); }
        }
      }
      if (queue.length > component.length) component = queue;
    }
    const pixels = Buffer.alloc(width * height * 4);
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (const p of component) {
      const x = p % width, y = Math.floor(p / width);
      const offset = ((top + y) * info.width + left + x) * 4;
      data.copy(pixels, p * 4, offset, offset + 4);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const crop = { x: left + x0, y: top + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    const image = await sharp(pixels, { raw: { width, height, channels: 4 } })
      .extract({ left: x0, top: y0, width: crop.w, height: crop.h }).png().toBuffer();
    sprites.push({ row, col, image, crop });
  }
  return { sprites, sourceSize: [info.width, info.height] };
}
