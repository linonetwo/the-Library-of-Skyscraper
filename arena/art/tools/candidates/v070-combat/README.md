# v0.7 layered cast / recover studies

Cast supports eight headings and four staff outfit/hair combinations (32
sequences). Recover remains a NE/SW warden/midnight/staff study pending visual
approval. All source layers remain independent. No public/index/runtime changes.

- `cast.mjs`: 8 stationary authored chant/point/settle poses, not faster attack.
- `recover.mjs`: exact accepted down final geometry; independently placed free
  left palm, knee flexion and foot loading, then the registered idle first pose.
- `anchors.mjs`: actual exported joints + attachment rotation and registered
  gripOffset/localContact; staffTip is the alpha-weighted uppermost visible
  source-row center (alpha>=128), transformed from the source staff pivot.
  All anchors are orig canvas pixels; trim changes no coordinate meaning.
- `bake.mjs`: existing pose-export / trim-atlas / preview-looks, no second renderer.
- `pack-ink.mjs`: explicit source-manifest input; four independent RGBA FX frames
  at one uniform scale and per-frame visual ellipse centers, without Y squash.

From repo root (existing art dependencies required):

```sh
node arena/art/tools/candidates/v070-combat/bake.mjs cast /scratch/new-pilot/cast NE,SW,N,NW,W,E,SE,S
node arena/art/tools/candidates/v070-combat/bake.mjs recover /scratch/new-pilot/recover
node arena/art/tools/candidates/v070-combat/pack-ink.mjs /source/manifest.json /scratch/new-pilot/ink-fx
node --test arena/art/tools/candidates/v070-combat/combat.test.mjs
```

Inputs: frozen ne-sw-idle / carry registrations, eight-combat down pose and
its grounded source, plus iso-v050-mobility/climb-hands/revised leftBrace.
Original parts are not edited. NE recover frame2 borrows the accepted E head
and hair at the same neck pivot as a side-roll bridge. Bearing boots use the
original upright boot rotation/scale and registered sole contact; the ankle
is inverse-projected from that unchanged world sole and the same limb lengths. Cast uses 192/pivot96,172.8; recover uses
256/pivot128,204.8. Recover idle wrist targets receive the same +32,+32 as
its canvas origin. The world root never rises or moves in the sprites. Recover left palm supports
f1..3, left foot is fixed at f3..5, right foot lands at f5. The free palm uses
existing hand-left-front, selected for either equipment mode by the same loader.

`atlas-budget.json` remains the single descriptor with optional
`anchorsByDirection[direction][frame]` holding `grip`, `staffTip`, and only
actual supporting frames `supportPalm` / `supportFoot`. Cast phaseFrames are
chanting0..2/release3..4/recovery5..7. Durations are preview timings; authority
controls cast/recovery gameplay timing. FX uses independent inkFx/ink/ground/00..03 keys with orig192/pivot96,96 and
playback once. No weaponFX pixels are synthesized here.

Current limitations: NE/SW cast and packed ink passed local visual study; full
eight-direction cast and revised recover are pending independent review. The
source brace hands were accepted for a ladder; the new
floor use needs independent review. First palm projection is approximately
0.7–1px above its z0 plane, and the first standing-raster transition is still
visual-study material. This pilot is not an accepted eight-direction action,
world contact proof, or complete 32-cast/64-recover appearance verification.
