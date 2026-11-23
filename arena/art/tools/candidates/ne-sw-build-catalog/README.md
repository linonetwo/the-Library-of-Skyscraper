# build-catalog NE/SW semantic candidate

Unapproved source candidate; independent body/outfit/hair/hand/tool pages, ground (96,172.8), scale 1. `output/atlas-budget.json` is the only runtime descriptor.

Rebuild from repo root: `node arena/art/tools/pose-export.mjs arena/art/tools/candidates/ne-sw-build-catalog/pose.json /tmp/build-catalog-review`. `preview-looks.mjs` accepts the same arguments for review-only combinations.

Full look GIFs and contact audit: `/home/user/arena-v030-work-evidence/build-catalog`. Staff is stowed behind torso for both empty working hands. World hip registration and fixed bone lengths preserved.

Rebuild working prop registration for both collect and build-catalog with `node arena/art/tools/candidates/ne-sw-build-catalog/build-work.mjs`, then export each pose as above. `work-props/source.png` is the successful independent material source; manifest keeps crop/contact provenance. No image generation is needed to rebuild.

`variants.building` selects work-prop-mallet + handMode grip; `variants.cataloging` selects work-prop-folio + handMode natural. `activeLayers` lists only the variable work props, never replaces base body/outfit/hair layers. Always include hand-left-front; choose exactly one of hand-front and hand-grip for the right hand. Weapon choice only toggles weapon-staff-back. Draw using layerOrderByDirection: staff/hair-back → body/outfit → body-front/outfit-front → selected prop → left hand/right hand → hair-front. No mallet and folio are baked together. The left palm supports the folio and the right palm presses its page edge; a separately animated page corner is not supplied in this candidate.

The four phases share one upper-body trajectory and clock [160,140,160,240] ms. Registered prop pivots follow solved natural palm or rotated mallet grip. Tool angles are absolute. This is candidate material for independent art review and runtime playback review, with no release approval.

Final export layout: `build/output/atlas-budget.json` and `catalog/output/atlas-budget.json` are separate stage clips. Select clip from authoritative task.stage. The parent pose is shared preparation input only and its previous shared output has been removed. `node arena/art/tools/candidates/ne-sw-build-catalog/build-stages.mjs` derives both stage poses. Both reuse source parts and phase durations, with independent wrist poses. Building shows one mallet/grip. Catalog keeps the open folio in left palm through all phases, with right natural palm sweep/press and recovery. No stage body override is interpreted at runtime.
