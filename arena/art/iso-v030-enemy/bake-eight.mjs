// Offline only. Uses the shared world chain and exporter; never renames or mirrors directions.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error('Usage: node bake-eight.mjs SOURCE_ENEMY_DIR OUTPUT_DIR');
const source = path.resolve(inputArg), output = path.resolve(outputArg);
if (source === output || output.startsWith(source + path.sep)) throw new Error('Output must be outside the source tree');
const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const registration = { upper: .265, lower: .255, hipZ: .54, ankleZ: .10, trackWidth: .16, worldSpeed: 1.5, cycleMs: 720, cycleStride: 1.08 };
const load = async file => JSON.parse(await readFile(file, 'utf8'));
const rigFile = path.join(source, 'six/standing-rig.json');
const rig = await load(rigFile);
const provenance = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exporter = fileURLToPath(new URL('../tools/pose-export.mjs', import.meta.url));

function poses(direction, action) {
  if (action === 'idle') return [0, -.6, 0, .4].map(breath => ({ durationMs: 400, worldStanding: true, joints: { neck: { offset: [0, breath] } } }));
  if (action === 'walk') return Array.from({length: 16}, (_, i) => {
    const phase = i / 16, c = Math.cos(i * Math.PI / 8), [x, y] = direction.worldForward;
    return { durationMs: 45, worldLegPhase: phase, contactFoot: i < 8 ? 'left' : 'right',
      rootScreenDelta: [64 * (x-y) * 1.08 * phase, 32 * (x+y) * 1.08 * phase],
      joints: { pelvis: { offset: [0, -.85 * Math.sin(i*Math.PI/8)**2], rotation: 1.4*c }, neck: { rotation: -.9*c }, leftShoulder: { rotation: -7*c }, rightShoulder: { rotation: 7*c } } };
  });
  if (action === 'hit') return [1, .3].map((strength, i) => {
    const [x,y] = direction.worldForward;
    return {durationMs: [100,150][i], worldStanding: true, joints: {
      pelvis: {offset: [-2*(x-y)*strength, -1*(x+y)*strength], rotation: -3*strength},
      neck: {rotation: 2.2*strength}, leftShoulder: {rotation: -12*strength}, rightShoulder: {rotation: 13*strength}, leftElbow: {rotation: 15*strength}, rightElbow: {rotation: -17*strength}
    }};
  });
  const side = direction.attackSide || 'right', j = direction.joints;
  const shoulder = j[side+'Shoulder'].cell, elbow = j[side+'Elbow'].cell, wrist = j[side+'Wrist'].cell;
  const lengths = Math.hypot(...j[side+'Elbow'].restOffset) + Math.hypot(...j[side+'Wrist'].restOffset);
  const [x,y] = direction.worldForward, forward = [64*(x-y),32*(x+y)], norm = Math.hypot(...forward);
  const reach = shoulder.map((v,i) => v + forward[i]/norm * lengths*.88);
  const tuck = shoulder.map((v,i) => v + (wrist[i]-v)*.65);
  const cross = (elbow[0]-shoulder[0])*(wrist[1]-shoulder[1])-(elbow[1]-shoulder[1])*(wrist[0]-shoulder[0]);
  const targets = direction.actionTargets?.attack || [wrist,tuck,reach,wrist].map(point => ({[side+'Wrist']: {point, bend: cross < 0 ? 1 : -1}}));
  return targets.map((wristTargets,i) => ({ durationMs: [120,180,120,200][i], worldStanding: true, joints: {}, wristTargets }));
}

async function materialize(direction, configFile, action, name) {
  const result = structuredClone(direction);
  delete result.actionTargets;
  for (const attachment of result.attachments) {
    const original = path.resolve(path.dirname(configFile), attachment.image);
    const bytes = await readFile(original), hash = sha256(bytes);
    const relative = `attachments/${name}/${attachment.id}-${hash.slice(0,12)}.png`;
    await mkdir(path.join(output, action, 'attachments', name), {recursive:true});
    await copyFile(original, path.join(output, action, relative));
    provenance.push({action, heading:name, attachment:attachment.id, source:path.relative(source, original), sha256:hash});
    attachment.image = relative;
  }
  return result;
}
await mkdir(output, {recursive:true});
for (const action of ['idle','walk','attack','hit','down']) {
  const templateFile = path.join(source, action, 'pose.json'), template = await load(templateFile);
  const extraFile = action === 'down' ? path.join(source,'six/down-rig.json') : rigFile;
  const extra = action === 'down' ? await load(extraFile) : rig;
  const config = {...template, status:'prototype', releaseApproved:false, directions:{}};
  if (action !== 'down') Object.assign(config, {cell:[192,192],groundPivot:[96,172.8],renderScale:1,worldRegistration:registration});
  else Object.assign(config, {cell:[256,256],groundPivot:[128,204.8],renderScale:1});
  config.notes = ['Eight true direction source registration; visual acceptance required.'];
  delete config.source;
  delete config.sourceSha256;
  for (const heading of headings) {
    const isOriginal = heading === 'NE' || heading === 'SW';
    const input = (isOriginal ? template : extra).directions[heading];
    if (!input) throw new Error(`Missing actual ${action} source for ${heading}`);
    const direction = await materialize(input, isOriginal ? templateFile : extraFile, action, heading);
    if (!isOriginal && action !== 'down') {
      if (!direction.worldForward) throw new Error(`Missing worldForward for ${heading}`);
      direction.poses = poses(input,action);
    }
    if (action === 'idle') direction.poses.forEach(p => {p.durationMs=400;});
    config.directions[heading] = direction;
  }
  config.frameCount = config.directions.N.poses.length;
  const poseFile = path.join(output,action,'pose.json');
  await writeFile(poseFile,JSON.stringify(config,null,2)+'\n');
  const result = spawnSync(process.execPath,[exporter,poseFile,path.join(output,action,'baked')],{stdio:'inherit'});
  if (result.status !== 0) throw new Error(`Export failed: ${action}`);
}
await writeFile(path.join(output,'source-registration.json'),JSON.stringify({status:'prototype',releaseApproved:false,registration,attachments:provenance},null,2)+'\n');
console.log(`Eight-direction clips and actual contact pages: ${output}`);
