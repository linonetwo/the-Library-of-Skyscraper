# NE/SW world-leg sixteen-phase prototype

Reproduce from repository root:

```
node arena/art/tools/build-walk16.mjs arena/art/tools/candidates/ne-sw-walk-16/keyposes.json /tmp/arena-world16-study
```

The old four-phase candidate remains unchanged in `../ne-sw-walk`. This candidate has16×45ms=.72s at1.5world units/s,1.08world units/cycle. NE projected root movement is[4.32,-2.16]per sample, SW the inverse. Natural walking is not yet approved: art accepted the skeleton/hip registration and colored contact page only for the next eight-second product-renderer review. Focus on SW2–4/11–13 knee occlusion and NE2–4 shoe outlines; verify bald/hair and outfit toggles against the true original192px anchor.

`keyposes.json` contains the four semantic arm/body controls and unchanged attachment snapshots. `pose.json` contains the sampled16-phase controls. Legs use a small fixed-world-length sagittal solve, then project each bone and map its registered attachment along that projected segment. World lengths are.3187701178/.3060520193; hipZ=.66,ankleZ=.11,trackWidth=.18,provisional swing lift=.08. Each world leg stays fixed in length; screen mapping ratios are explicit, approximately.707–1.191. Image thickness, body/head size and boot shape are preserved. Art accepted the hip placement beneath the source torso/skirt. Original sole pivots imply explicit ground-plane footprint offsets, not a hidden y correction.

`output/world-cycle-report.json` audits two cycles, support switches and phase16 closure. Sole error is below1e-15world and local seam error0 in this numerical study. This is a keyframe result: continuous root movement during45ms sprite hold still has a4.83screen-pixel displacement bound. Natural motion, shoe/hand contact and occlusion require actual product video.

Five active layers are alpha-trimmed with original192×192 size, normalized pivot(.5,.9),2px extrusion and no rotation. Nine inactive legacy layers have no exported atlas. `atlas-budget.json` reports actual page sizes and decoded memory:1,959,080bytes for these NE/SW scholar/ivory layers (PNG sizes separate, optional mipmaps add4/3). All pages fit2048px.160 source frames were reconstructed from the trimmed atlases and matched every visible RGBA pixel and original anchor. Reproduction and numeric checks do not grant release approval.

The second wardrobe snapshot adds independently registered midnight front/back hair and warden torso/far sleeves/near sleeves. `outfit-warden-front` is a real registered layer after `body-front`; it is collected from attachments instead of a fixed fourteen-layer allowlist. Atlas pages are still independent layer assets. `previewLooks` lists four appearance combinations for review-only contact/GIF composition, not separate whole-character runtime sheets. Weapon-on is not implemented in this second snapshot. The nine current active layers total2,920,520 decoded bytes; per-page data is authoritative in `atlas-budget.json`.
