# Eight direction base candidate, 2026-11-23

Runtime entry points: `merged/walk/atlas-budget.json`, `merged/idle/atlas-budget.json`. One descriptor per action, independent body / outfit / hair / weapon layers; eight appearance combinations are review composites only. Direction-specific source attachments and world headings. No mirrored whole-body or NE screen-coordinate cloning.

Walk: 16 × 45 ms, 720 ms, 1.08 world/cycle, 1.5 world/s. Idle: 4 × 400 ms, breathing hip .700/.708/.700/.692, world-standing feet. All original cells 192², pivot [96,172.8], render scale 1; trimmed atlas pages ≤2048.

Rebuild:
```
node build-eight-base.mjs N,S,NW,SE
node build-eight-base.mjs E,W
node merge-eight-base.mjs
```

`inputs/art` preserves the actual registered PNG/metadata input files used for six directions. `inputs/ew-template.json` preserves appearance metadata. `inputs/frozen-ne-sw` preserves frozen NE/SW atlases without resolving/rebaking those reviewed animations. `source-hashes.json` records SHA256 for all snapshots. The build imports the existing frozen atlas tool modules in `/home/user/arena-v030-atlas-tools/arena/art/tools`; it does not edit them.

Four new walk directions report maximum sole world error < 7.1e-16 and zero cycle seam error. Merged walk: 1536 unique frames, 13,435,888 decoded bytes; idle: 384 unique frames, 2,867,716 decoded bytes. Merge validates registration, frame timings, distinct direction/frame keys, and page bounds. Default layer order is explicitly declared for each direction; staff front/back assignment and near arm layer come from each direction's source registration.

Astra review: old EW walk and new N/S/NW/SE walk approved as candidates. New EW walk and six-direction 4-phase idle also independently approved by Astra; see freeze.json and contact-summary.json. `releaseApproved=false` remains in pose inputs. This base batch does not complete P3 action production.
