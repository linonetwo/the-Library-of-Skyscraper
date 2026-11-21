const rotate = ([x, y], a) => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
export function stamp(canvas, width, height, image, point, pivot, a) {
  // Inverse sampling preserves the declared pivot even when rotation changes the image bounds.
  const corners = [
    [0, 0],
    [image.width, 0],
    [0, image.height],
    [image.width, image.height],
  ].map((p) => add(point, rotate(sub(p, pivot), a)));
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0])))),
    x1 = Math.min(width, Math.ceil(Math.max(...corners.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1])))),
    y1 = Math.min(height, Math.ceil(Math.max(...corners.map((p) => p[1]))));
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const source = add(rotate(sub([x + 0.5, y + 0.5], point), -a), pivot).map(
          (v) => v - 0.5,
        ),
        sx = Math.floor(source[0]),
        sy = Math.floor(source[1]);
      const color = [0, 0, 0, 0];
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++) {
          const ix = sx + dx,
            iy = sy + dy;
          if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height)
            continue;
          const weight =
              (dx ? source[0] - sx : 1 - source[0] + sx) *
              (dy ? source[1] - sy : 1 - source[1] + sy),
            i = (iy * image.width + ix) * 4,
            alpha = image.data[i + 3] / 255;
          color[3] += alpha * weight;
          for (let c = 0; c < 3; c++)
            color[c] += image.data[i + c] * alpha * weight;
        }
      const i = (y * width + x) * 4,
        alpha = color[3],
        oldAlpha = canvas[i + 3] / 255,
        outAlpha = alpha + oldAlpha * (1 - alpha);
      if (!outAlpha) continue;
      for (let c = 0; c < 3; c++)
        canvas[i + c] = Math.round(
          (color[c] + canvas[i + c] * oldAlpha * (1 - alpha)) / outAlpha,
        );
      canvas[i + 3] = Math.round(outAlpha * 255);
    }
}
