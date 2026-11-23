# Offline registered attachment pose tools

The four frozen NE/SW player candidates are `ne-sw-walk-16`, `ne-sw-attack`, `ne-sw-hit` and `ne-sw-idle`. Install the existing art package dependency with `npm ci --prefix arena/art`, then rebuild and verify all four from the repository root:

```sh
node arena/art/tools/rebuild-frozen-clips.mjs /tmp/arena-frozen-clips
```

This command exports each clip, checks every runtime atlas PNG/JSON byte and the semantic descriptor against its frozen output, and writes `rebuild-result.json` with page hashes. It needs only this checkout and `sharp`; no service, API, image generation or external source tree is used. Shared final-pixel attachment inputs are in `sources/ne-sw-registered`; full registration and explicit pose targets are in each candidate's `pose.json`. The original generated large sheets are provenance, not hidden build inputs.

For one candidate, use `node arena/art/tools/pose-export.mjs CONFIG.json OUTPUT_DIRECTORY`. Optional `preview-looks.mjs CONFIG.json OUTPUT_DIRECTORY` composes the eight independent appearance combinations for review. The repository retains the actual runtime pages, unique `atlas-budget.json` descriptor and one contact sheet per clip; other large review GIFs, skeleton pages and contact reports are reproducible rather than committed.

Each descriptor records action, exact frame durations, playback, original canvas/pivot/scale, directions, active layers and all atlas pages. Walk carries its world stride; one-shot clips do not invent a stride. Independent scholar/warden, ivory/midnight and natural/gripping hand choices remain composable layer sets. Empty layers have no pages. Trimmed cells retain their original 192px canvas and ground pivot; pages fit 2048px with two-pixel extrusion.

`world-chain.mjs` solves an anatomical two-segment chain in an authoring plane. `world-leg.mjs` supplies the heading/height leg plane and projection; `world-walk.mjs` supplies stance/swing targets and cycle audits. `world-pose.mjs` maps the projected segment endpoints to registered pixel axes; source thickness and boot shape stay unchanged. `pose-kinematics.mjs` handles explicit arm targets, `pose-raster.mjs` handles alpha sampling, `trim-atlas.mjs` packs pages, and `pose-export.mjs` assembles the clip and reports. Real unreachable targets fail instead of stretching anatomical lengths.

Art accepted these contact-page candidates for product playback review. This does not grant release or natural-motion acceptance. Attack without a staff is an open-hand gesture candidate. Idle is actual fixed-foot breathing; down and the separate work/carry actions are outside this source batch. Numeric foot locks describe keyframes: continuous actor motion during held walk frames still has a 4.83px displacement bound. Development evidence lives at `/home/user/arena-v030-atlas-evidence` and is not required to reproduce the source.
