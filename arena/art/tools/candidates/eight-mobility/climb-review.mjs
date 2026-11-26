import sharp from "sharp";
import path from "node:path";

// Copy exported pixels once, rather than decoding the full 66-frame sheet for
// every crop. Actual outfit sheets retain the descriptor's directional order.
export async function writeClimbReviewSheets(out, directionCount, lookCount, ranges) {
  for (const [source, rows, suffix] of [
    ["contact-sheet.png", directionCount, "-sample.png"],
    ["looks-contact.png", directionCount * lookCount, "-looks.png"],
  ]) {
    const { data, info } = await sharp(path.join(out, source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [phase, range] of Object.entries(ranges)) {
      const offsets = range.last - range.first === 24 ? [0,4,8,12,16,20,23,24] : [0,1,2,3,4,5,6,7];
      const width = 8 * 256, height = rows * 256;
      const pixels = Buffer.alloc(width * height * 4);
      for (let row = 0; row < rows; row++) for (const [column, offset] of offsets.entries())
        for (let y = 0; y < 256; y++) {
          const start = ((row * 256 + y) * info.width + (range.first + offset) * 256) * 4;
          data.copy(pixels, ((row * 256 + y) * width + column * 256) * 4, start, start + 256 * 4);
        }
      await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(path.join(out, phase + suffix));
    }
  }
}
