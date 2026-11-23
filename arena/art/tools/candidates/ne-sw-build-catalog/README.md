# Building and cataloging NE/SW candidates

Final clips: `build/output/atlas-budget.json` and `catalog/output/atlas-budget.json`. Each is the sole runtime descriptor for its clip. Choose build/catalog from authoritative task.stage; both use [160,140,160,240] ms and share source parts. No runtime bone override is needed.

`pose.json` in this parent is preparation input only. Rebuild stage poses from repository root with `node arena/art/tools/candidates/ne-sw-build-catalog/build-stages.mjs`, then use pose-export.mjs with each stage/pose.json and a chosen output directory. The work-props manifest records crop/contact provenance; source.png is the successful independent material source. `build-work.mjs` rebuilds prop registration in the preparation input and the sibling collect pose.

Building uses work-prop-mallet and hand-grip; cataloging uses work-prop-folio and hand-front. hand-left-front is always visible. Equipment toggles only weapon-staff-back, because the working staff is stowed. Draw according to layerOrderByDirection: staff/hair-back, body/outfit, body-front/outfit-front, selected prop, hands, hair-front. The mallet and folio never share a rendered layer. Building moves the hammer outside the body; cataloging keeps the folio visible in the left palm through recovery while the right hand presses its page edge. No independently animated page is claimed.

Astra visually accepted these NE/SW offline stage candidates on 2026-11-23; acceptance does not cover eight directions or product playback. Release approval remains false. Review GIFs and large reports are local evidence at /home/user/arena-v030-work-evidence/{build,catalog}.
