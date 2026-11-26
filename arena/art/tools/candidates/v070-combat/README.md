# v0.7 cast / recover two-direction pilot

Unreviewed NE/SW technical-art samples. Only warden/midnight/staff is previewed;
all source layers remain independent. No public/index or runtime changes.

- `cast.mjs`: 8 stationary authored chant/point/settle poses, not faster attack.
- `recover.mjs`: exact accepted down final geometry; independently placed free
  left palm, knee flexion and foot loading, then the registered idle first pose.
- `anchors.mjs`: actual exported joints + attachment rotation and registered
  gripOffset/localContact; staffTip is the alpha-weighted uppermost visible
  source-row center (alpha>=128), transformed from the source staff pivot.
  All anchors are orig canvas pixels; trim changes no coordinate meaning.
- `bake.mjs`: existing pose-export / trim-atlas / preview-looks, no second renderer.

From repo root (existing art dependencies required):

```sh
node arena/art/tools/candidates/v070-combat/bake.mjs cast /scratch/new-pilot/cast
node arena/art/tools/candidates/v070-combat/bake.mjs recover /scratch/new-pilot/recover
node --test arena/art/tools/candidates/v070-combat/combat.test.mjs
```

Inputs: frozen ne-sw-idle / carry registrations, eight-combat down pose and
its grounded source, plus iso-v050-mobility/climb-hands/revised leftBrace.
Original parts are not edited. Cast uses 192/pivot96,172.8; recover uses
256/pivot128,204.8. Recover idle wrist targets receive the same +32,+32 as
its canvas origin. The world root never rises or moves in the sprites.

`atlas-budget.json` remains the single descriptor with optional
`anchorsByDirection[direction][frame]` holding `grip`, `staffTip`, and only
actual supporting frames `supportPalm` / `supportFoot`. Cast phaseFrames are
chanting0..2/release3..4/recovery5..7. Durations are preview timings; authority
controls cast/recovery gameplay timing. No weaponFX pixels are synthesized here.

Current limitations: source brace hands were accepted for a ladder; the new
floor use needs independent review. First palm projection is approximately
0.7–1px above its z0 plane, and the first standing-raster transition is still
visual-study material. This pilot is not an accepted eight-direction action,
world contact proof, or complete 32-cast/64-recover appearance verification.
