// Copy only a registered clip's descriptor and actual runtime pages, preserving nested page paths.
import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node copy-runtime-clip.mjs BAKED_DIRECTORY PUBLIC_CLIP_DIRECTORY');
const descriptor = JSON.parse(await readFile(path.join(source, 'atlas-budget.json'), 'utf8'));
const files = new Set(['atlas-budget.json']);
for (const layer of descriptor.layers) for (const page of layer.pages) {
  files.add(page.image); files.add(page.json);
}
const hashes = {};
for (const file of files) {
  const target = path.join(destination, file);
  await mkdir(path.dirname(target), {recursive:true});
  const bytes = await readFile(path.join(source, file));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  await copyFile(path.join(source, file), target);
}
await writeFile(path.join(destination, 'source-hashes.json'), JSON.stringify(hashes, null, 2)+'\n');
console.log(`${descriptor.clip.action}: ${files.size} runtime files copied to ${destination}`);
