# Eight-direction semantic work candidates

Each action has one runtime entry point: `merged/{carry,unload,collect,build,catalog}/atlas-budget.json`. These preserve the independently reviewed NE/SW pages and merge six newly registered directions E/W/N/S/NW/SE. No runtime code changes are included; product playback and release acceptance remain separate.

All clips use 192-square cells, pivot (96,172.8), renderScale 1, fixed world bone lengths and direction-specific source joints/heading. Carry uses 16×45 ms, 720 ms/1.08 world stride. Unload uses [180,160,260] ms, releaseFrame 1, cargo transparent in phase 2. Collect uses [180,120,180,220] ms and paper only in phases 1/2. Build/catalog use separate wrist trajectories on the shared [160,140,160,240] ms clock. Catalog keeps the folio visible through recovery and presses the actual page edge/center; it does not claim animated page turning.

The successful new six-direction work material source, prompts and actual pixel registrations are self-contained in inputs/work-props. No mirrored or squeezed prop substitutes for a view. inputs/art contains frozen directional rigs, clothes, hair and staff. Natural palms were split from actual arm sources; Astra approved the contact positions, including corrected S offsets. hands/contact-proposals.png rows E/W/N/S/NW/SE, red=wrist and green=approved palm.

Rebuild from repository root:

```
node arena/art/tools/candidates/eight-work/register-hands.mjs
node arena/art/tools/candidates/eight-work/build-work-clips.mjs
node arena/art/tools/candidates/eight-work/audit-contacts.mjs
node arena/art/tools/candidates/eight-work/merge-work-clips.mjs
node arena/art/tools/candidates/eight-work/validate-atlases.mjs
```

The same shared pose-export/world-leg/IK modules generate every action. The shared preview-looks module reads the same per-direction layerOrderByDirection as the product descriptor. Six-direction intermediate pose/pages and large reports go to ignored six/. Appearance composites are review-only: run preview-looks.mjs with six/{action}/pose.json and six/{action}. Review composites must follow descriptor ordering; the shared exporter's generic contact-sheet follows attachment insertion order and is not the accepted semantic occlusion reference. Correctly ordered review-contact.png and eight look GIFs are retained in /home/user/arena-v030-eight-work-evidence/{action}. One correctly ordered six-direction contact image per action is checked in under review/.

The descriptor's appearanceOptions chooses outfit/hair and weapon; work uses a stowed weapon-staff-back and a hand-left-front layer. Select one right hand, hand-front for natural or hand-grip for build. Add cargoLayers/workLayers from appearanceOptions and respect layerOrderByDirection; no prop is baked into body/outfit. NE/SW carry/unload retain their existing combined natural hands, so a missing hand-left-front frame is valid for those two directions. NE/SW frozen page bytes and frame keys are preserved.

validation.json records readback of 135 PNG pages, unique keys/bounds, eight directions, timing/registration consistency and transparent unload recovery cargo. Contact auditing checks 288 actual palm/grip/prop points against exported joints at subpixel precision. These numerical checks do not imply visual or release approval. New six-direction action visual review is pending.
