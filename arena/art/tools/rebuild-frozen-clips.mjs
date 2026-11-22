import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { exportPoses } from "./pose-export.mjs";

const tools = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.argv[2]);
const results = [];
for (const name of [
  "ne-sw-walk-16",
  "ne-sw-attack",
  "ne-sw-hit",
  "ne-sw-idle",
]) {
  const candidate = path.join(tools, "candidates", name),
    destination = path.join(output, name);
  await exportPoses(path.join(candidate, "pose.json"), destination);
  const expected = JSON.parse(
    await readFile(path.join(candidate, "output/atlas-budget.json")),
  );
  const actual = JSON.parse(
    await readFile(path.join(destination, "atlas-budget.json")),
  );
  assert.deepEqual(actual, expected, `${name}: clip descriptor differs`);
  const pages = [];
  for (const layer of actual.layers.filter((layer) => layer.active))
    for (const page of layer.pages)
      for (const file of [page.image, page.json]) {
        const bytes = await readFile(path.join(destination, file));
        assert(
          (await readFile(path.join(candidate, "output", file))).equals(bytes),
          `${name}: ${file} differs`,
        );
        pages.push({
          file,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
  results.push({
    candidate: name,
    clip: actual.clip,
    decodedBytes: actual.decodedBytes,
    pages,
  });
  console.log(`PASS ${name}: exact atlas pages and descriptor`);
}
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "rebuild-result.json"),
  JSON.stringify(results, null, 2) + "\n",
);
