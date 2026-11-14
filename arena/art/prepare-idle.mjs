import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { extractSourceSprites } from './source-sprites.mjs';
import { directions, frameName } from './animation-spec.mjs';
import { sourceGripTracks, staffDepth } from './staff-registration.mjs';
import { art, output, digest, json, keepPixel, place, breathe, foregroundHands, packLayer, sourceProvenance, clearCell } from './idle-pipeline.mjs';

const read = name => readFile(new URL(`source/${name}`, art));
const bodySource = await read('idle-body.png');
const garmentSource = await read('idle-outfits.png');
const bodies = await extractSourceSprites(bodySource, { columns: 2, rows: 4, keepPixel });
const garments = await extractSourceSprites(garmentSource, { columns: 2, rows: 8, keepPixel });
// Reviewed standing silhouettes: both soles at y=173; no source walk body is consumed.
const bodyPlacements = [
  [65,15,62,158], [64,15,64,158], [66,15,60,158], [64,15,64,158],
  [65,15,62,158], [64,15,64,158], [66,15,60,158], [64,15,64,158],
];
const garmentPlacements = [
  [73,77,46,42], [74,77,43,42], [79,76,31,43], [74,77,43,42],
  [73,77,46,42], [75,77,43,42], [82,76,31,43], [75,77,43,42],
];
const hairPlacements = [
  [61,9,70,62], [57,9,72,62], [59,9,68,62], [60,9,70,64],
  [61,9,70,64], [62,9,70,64], [65,9,68,62], [64,9,72,62],
];
const hands = [[74,123],[73,122],[88,121],[116,122],[117,122],[118,122],[105,121],[119,122]];
const all = {}, recipes = {}, registrations = [], layerRegistrations = {};
const bodyProv = await sourceProvenance('idle-body.png', 'idle-body-prompt.txt',
  'Eight newly generated dedicated standing views, normalized to planted soles; four upper-body breathing deformations with unchanged lower body.');
const clothProv = await sourceProvenance('idle-outfits.png', 'idle-outfits-prompt.txt',
  'Newly generated standing garments, eight dedicated directional views per outfit; registered breathing and hem flutter.');
all.body = []; all['body-front'] = [];
for (let row = 0; row < 8; row++) {
  const sprite = bodies.sprites[row], base = await place(sprite.image, bodyPlacements[row]);
  all.body[row] = []; all['body-front'][row] = [];
  for (let col = 0; col < 4; col++) {
    const body = await breathe(base, col);
    all.body[row].push(body); all['body-front'][row].push(await foregroundHands(body));
    const lift = [0,-0.8,-1.35,-0.55][col];
    registrations.push({ frame: frameName('idle', 'body', directions[row], col), sourceCrop: sprite.crop,
      placement: bodyPlacements[row], durationMs: 250, solesY: 172,
      attachments: { crown: [96, 15 + lift], neck: [96, 77 + lift], hip: [96,128],
        rightHand: [hands[row][0], hands[row][1] + lift * Math.max(0,(132-hands[row][1])/55)],
        leftHand: [192-hands[row][0], hands[row][1] + lift * Math.max(0,(132-hands[row][1])/55)] },
      deformation: { lift, lowerBodyFixedFromY: 132 } });
  }
}
recipes.body = bodyProv; recipes['body-front'] = { ...bodyProv, method: 'Foreground skin and outline pixels sampled from each corresponding standing body frame.' };
layerRegistrations.body = registrations;
layerRegistrations['body-front'] = registrations.map(entry => ({ ...entry, frame: entry.frame.replace('/body/','/body-front/'), extraction: 'body skin/outline mask y90..133' }));
for (const [index, layer] of ['outfit-scholar', 'outfit-warden'].entries()) {
  all[layer] = []; layerRegistrations[layer] = [];
  for (let row = 0; row < 8; row++) {
    const sprite = garments.sprites[row * 2 + index], p = [...garmentPlacements[row]];
    if (index === 1) { p[0] -= 3; p[2] += 6; }
    const base = await place(sprite.image, p);
    all[layer][row] = await Promise.all([0,1,2,3].map(col => breathe(base, col, { kind: 'cloth' })));
    for (let col=0;col<4;col++) layerRegistrations[layer].push({ frame:frameName('idle',layer,directions[row],col),
      sourceCrop:sprite.crop, placement:p, phase:col, deformation:'upper-body breath + delayed hem sway', durationMs:250 });
  }
  recipes[layer] = clothProv;
}
for (const hair of ['ivory', 'midnight']) {
  const layer = `hair-${hair}`, bytes = await read(`walk-${layer}.png`);
  const source = await extractSourceSprites(bytes, { columns: 4, rows: 8,
    keepPixel: (r,g,b,a) => keepPixel(r,g,b,a) && (hair !== 'ivory' || Math.max(r,g,b)-Math.min(r,g,b)>8) });
  all[layer] = []; all[`${layer}-back`] = []; all[`${layer}-front`] = []; layerRegistrations[layer] = [];
  for (let row = 0; row < 8; row++) {
    const placement = [...hairPlacements[row]];
    if (hair === 'midnight') { placement[0] -= 3; placement[2] += 6; }
    const base = await place(source.sprites[row * 4].image, placement);
    all[layer][row] = []; all[`${layer}-back`][row] = []; all[`${layer}-front`][row] = [];
    for (let col = 0; col < 4; col++) {
      const cell = await breathe(base, col, { kind: 'hair' });
      layerRegistrations[layer].push({ frame:frameName('idle',layer,directions[row],col),
        sourceCrop:source.sprites[row*4].crop, placement, phase:col, durationMs:250,
        sharedSourceColumn:0, deformation:'idle crown breath + delayed hair tip sway' });
      all[layer][row].push(cell);
      const { data, info } = await sharp(cell).raw().toBuffer({ resolveWithObject: true });
      const back = Buffer.alloc(data.length), front = Buffer.from(data);
      // Only hanging outer locks belong behind the torso; face-framing bangs stay in front.
      for (let y = 53; y < 192; y++) for (let x = 0; x < 192; x++) {
        if (x >= 75 && x <= 117) continue;
        const p = (y * 192 + x) * 4; data.copy(back, p, p, p + 4); front.fill(0,p,p+4);
      }
      all[`${layer}-back`][row].push(await sharp(back, { raw: info }).png().toBuffer());
      all[`${layer}-front`][row].push(await sharp(front, { raw: info }).png().toBuffer());
    }
  }
  const provenance = await sourceProvenance(`walk-${layer}.png`, `walk-${layer}-prompt.txt`,
    'Shared directional hair artwork (column 0 only), re-registered to dedicated idle crown; low-amplitude lagged tip sway, not a reused walk animation.');
  for (const key of [layer, `${layer}-back`, `${layer}-front`]) recipes[key] = provenance;
  for (const depth of ['back','front']) layerRegistrations[`${layer}-${depth}`] = layerRegistrations[layer].map(entry => ({
    ...entry, frame:entry.frame.replace(`/${layer}/`,`/${layer}-${depth}/`), depth,
    split:'outer hanging locks y>=53 and x<75 or x>117 behind body; remaining cap and bangs in front' }));
}
const staffSource = await extractSourceSprites(await read('walk-weapon-staff.png'),
  { columns: 4, rows: 8, keepPixel });
const staffProv = await sourceProvenance('walk-weapon-staff.png', 'walk-weapon-staff-prompt.txt',
  'Shared directional staff design, column 0 only; dedicated relaxed standing right-hand grip and direction-specific depth, independent from walk carry track.');
const staffAttachments = [];
for (const layer of ['weapon-staff', 'weapon-staff-back', 'weapon-staff-front']) { all[layer] = []; recipes[layer] = staffProv; }
const empty = await clearCell().png().toBuffer();
for (let row = 0; row < 8; row++) {
  const sprite = staffSource.sprites[row * 4], { crop } = sprite;
  const localTop = Math.round(row * staffSource.sourceSize[1] / 8);
  const [gx, gy] = sourceGripTracks[row][0];
  const scale = 0.53, w = Math.round(crop.w * scale), h = Math.round(crop.h * scale);
  const x = Math.round(hands[row][0] - (gx-crop.x) * w/crop.w);
  const y = Math.round(hands[row][1] - (gy-(crop.y-localTop)) * h/crop.h);
  const base = await place(sprite.image, [x,y,w,h]);
  for (const layer of ['weapon-staff', 'weapon-staff-back', 'weapon-staff-front']) all[layer][row] = [];
  for (let col = 0; col < 4; col++) {
    const cell = await breathe(base, col, { kind: 'staff' });
    all['weapon-staff'][row].push(cell);
    for (const depth of ['back','front']) all[`weapon-staff-${depth}`][row].push(staffDepth[row] === depth ? cell : empty);
    staffAttachments.push({ frame: frameName('idle','weapon-staff',directions[row],col), hand: 'right',
      grip: { x: hands[row][0], y: registrations[row*4+col].attachments.rightHand[1] },
      depth: staffDepth[row], sourceGrip: { x:gx, y:gy }, placement: [x,y,w,h], carryLeanDegrees: 0 });
  }
}
const packed = {};
for (const layer of ['weapon-staff','weapon-staff-back','weapon-staff-front'])
  layerRegistrations[layer] = staffAttachments.map(entry => ({ ...entry,
    frame:entry.frame.replace('/weapon-staff/',`/${layer}/`), durationMs:250 }));
for (const [layer, cells] of Object.entries(all)) {
  const recipe = { schemaVersion:1, action:'idle', layer, source:recipes[layer].source,
    sourceSha256:recipes[layer].sourceSha256, frames:layerRegistrations[layer] };
  const recipeBytes = Buffer.from(json(recipe));
  await writeFile(new URL(`source/idle-${layer}-registration.json`,art),recipeBytes);
  packed[layer] = await packLayer(layer, cells, { ...recipes[layer], recipeSha256:digest(recipeBytes),
    registration:`arena/art/source/idle-${layer}-registration.json` });
}
await writeFile(new URL('source/idle-registration.json', art), json({
  schemaVersion: 1, action: 'idle', cell: [192,192], anchor: [0.5,0.9], fps: 4, loop: true,
  directionOrder: directions, phaseNames: ['rest','inhale','full-breath','exhale'], frames: registrations,
  garmentPlacements, hairPlacements, sources: { body: bodyProv, garments: clothProv },
}));
const layerOrder = ['weapon-staff-back','hair-back','body','outfit','weapon-staff-front','body-front','hair-front'];
await writeFile(new URL('idle-weapon-staff.attachments.json', output), json({
  schemaVersion: 1, action: 'idle', cell: [192,192], layerOrder, attachments: staffAttachments,
}));
await writeFile(new URL('idle-registration.json', output), await readFile(new URL('source/idle-registration.json', art)));
for (const outfit of ['scholar','warden']) for (const hair of ['ivory','midnight']) for (const held of [false,true]) {
  const order = [
    ...(held ? ['weapon-staff-back'] : []), `hair-${hair}-back`, 'body', `outfit-${outfit}`,
    ...(held ? ['weapon-staff-front'] : []), 'body-front', `hair-${hair}-front`,
  ];
  await sharp({ create: { width: 784, height: 1568, channels: 4, background: '#00000000' } })
    .composite(order.map(layer => ({ input: packed[layer].image }))).png()
    .toFile(new URL(`idle-${outfit}-${hair}${held ? '-staff' : ''}-preview.png`, art).pathname);
}
const coveragePath = new URL('coverage.json', output);
const coverage = JSON.parse(await readFile(coveragePath, 'utf8'));
for (const entry of coverage.coverage) if (entry.action === 'idle') {
  entry.status = 'prototype'; entry.atlas = `idle-${entry.layer}.json`;
  entry.frames = packed[entry.layer].atlas.animations[`idle/${entry.layer}/${entry.direction}`];
}
coverage.contentVersion = 'arena-animation-2026-11-14.idle.1'; coverage.generatedOn = '2026-11-14';
coverage.auxiliaryLayers = (coverage.auxiliaryLayers ?? []).filter(e => e.action !== 'idle');
for (const layer of ['body-front','weapon-staff-back','weapon-staff-front','hair-ivory-back','hair-ivory-front','hair-midnight-back','hair-midnight-front'])
  coverage.auxiliaryLayers.push({ action:'idle', layer, atlas:`idle-${layer}.json`, purpose:'Dedicated idle occlusion layer; see idle-registration.json and idle-weapon-staff.attachments.json.' });
coverage.idleSources = [bodyProv, clothProv, recipes['hair-ivory'], recipes['hair-midnight'], staffProv];
coverage.review.idle = 'Dedicated eight-direction standing body and garments. Four breathing/hem/hair deformation frames with bit-identical lower-body pixels. Both hair styles and staff use shared designs with idle-only registrations. All combinations remain prototype pending human approval of proportions, grip closure and transitions.';
await writeFile(coveragePath, json(coverage));
console.log(`Packed ${Object.keys(all).length} idle atlases, 32 frames each; eight outfit/hair/weapon composition previews. No release approval claimed.`);
