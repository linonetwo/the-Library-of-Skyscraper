# Four-head layered character production — 2026-11-17

Scope: v0.2.0 idle/walk, eight views × two outfits × two hair designs × empty/staff. Run is deferred to v0.3.0 candidate. All current work remains prototype.

## Neutral fit stage

The installed proxy-imagegen script/GPT Image 2 generated two text-only sources:

- `four-head-neutral.png`, 1,122,376 bytes: first attempt succeeded.
- `four-head-outfits.png`, 1,337,854 bytes: attempt 1 ended with connection/SSE interruption; the same script retried and attempt 2 succeeded.

The successful sources are preserved unchanged; neither was requested again. Adjacent prompt files contain exact text. No reference images were uploaded; no API key, response body or encoded payload is stored.

The base-body source **did not satisfy the prompted four-head ratio**: it resembles a roughly six-head elongated anatomy. `four-head-registration.mjs` therefore performs explicit piecewise anatomical registration, not a runtime stretch: skull/neck/waist/hip/knee/sole are remapped to the authored four-head skeleton and head width is independently normalized. The source deviation is recorded in every registration recipe. Neutral target crown y12 / chin y52 / sole y172 gives 160px/40px = four head units; raster silhouette differs at most one pixel. Ground anchor remains `(96,172.8)`, deliberately 0.8px below opaque sole row172; this is one fixed registration offset, not per-frame foot drift.

Connected near-white background matte is flood-removed from the base source before premultiplied-alpha resampling. The body is an undershirt/shorts/boots **base layer**, never a finished dressed portrait. New scholar/warden garment-only sprites are independently registered. Existing ivory/midnight directional hair designs and staff design are reused, resized and registered to new crown/hand positions. Each source view is dedicated, not mirrored. Body foreground arms are extracted from that corresponding anatomy; the shoulder zone remains behind clothing/armor. A separate closed-grip view covers the shaft for held-staff combinations only.

`node prepare-four-head-fit.mjs` writes eight independent direction×layer sets, anatomical registrations and eight 4×2 contact sheets under `four-head-fit/`. This is a design-fit output, not a replacement for the runtime idle/walk atlases. The two actions must migrate together after fit review; no old/new proportion mixture is considered delivered.

The neutral anatomy test measures every view against the four-head contract and transparent cell boundary. Contact sheets are not runtime screenshots or independent approval. Collar/shoulder fit, scalp/ear coverage, hand–shaft joins, both hairstyles and directional consistency require visual review before expanding the action source production.

## Independent fit gate and action production

Independent Astra inspected all eight equipment sheets × eight neutral views (64 combinations) and approved the **neutral production fit gate**, not release art. The visible hair-to-sole silhouette reads approximately 3.7–4 heads; no further body elongation was requested. Collar/shoulder fit, side/back hair continuity and neutral empty/staff contact were accepted at contact-sheet scale. Subsequent action review must still inspect fingers over shaft, W/E hair/shoulder intersections and shoulder-guard motion.

Three further proxy-imagegen/GPT Image 2 calls each succeeded on the first attempt:

- `four-head-walk-body.png`: 1,396,487 bytes; 4×8 genuinely generated walking base poses.
- `four-head-walk-scholar.png`: 1,729,121 bytes; 4×8 independent scholar garment poses.
- `four-head-walk-warden.png`: 1,669,075 bytes; 4×8 independent warden garment poses.

Prompts are adjacent; no image upload or successful-source rerun. Body and garment sources again have non-target proportions and are explicitly registered to the reviewed neutral anatomy. Source pose geometry is retained; no neutral body is reused to manufacture walking. The generated sheet contains side-view contact silhouettes that are quite similar between phases00/02; distinct pixel hashes do **not** prove a correct alternating gait. This remains a specific visual continuity review item, not an approved claim.

`four-head-idle.mjs` creates four 250ms upper-body breathing/hem/hair phases from the independent neutral source, with every body pixel below y112 unchanged. `four-head-walk.mjs` registers the 32 dedicated walking body and garment poses, four existing hair poses per view and individually authored original-palm hand tracks. E carry lean is negative so the rear-depth shaft extends outside the body silhouette instead of disappearing behind it. Hair splits are made from final deformed aggregate cells so front+back reconstruct their source exactly.

`prepare-four-head-actions.mjs` packs both actions together: 28 atlases, 32 cells each, 192px cells with 2px padding, anchor `(0.5,0.9)`, complete per-layer source crop/placement/hash recipes, durations and both-hand/hip/neck/crown tracks. It replaces both runtime actions, including four new walk front/back hair atlases. Body-front is a foreground arm/hand mask from the matching body; held-only small closed fingers cover the registered shaft rather than adding an independent floating fist. All eight equipment combinations are rendered by `motion-previews.mjs`; all remain prototype.

Rebuild: `npm run build:animation`; tile rebuild: `npm run build:tiles`; tests: `npm test`. The 21 art tests include four-head proportion agreement, baseline, no idle lower-body movement, four distinct authored walk phases, current source/recipe hashes, all hair/staff depth masks and finger/shaft alpha contact. Tests and contact sheets do not replace real-client, independent frame-by-frame approval.

## Action review blocker

Independent Astra inspected all four action comparison sheets and an empty-hand walk sheet. W/E phases00/02 retain the same near-leg contact and phases01/03 repeat the same support relationship; SW/NW/NE show the same half-cycle issue. Free-arm swing does not alternate correctly either. This is a **walk action gate failure**, not just similar silhouettes and not caused by staff occlusion. Neutral fit remains accepted; idle's full four-frame sheet introduced no new contact-sheet-scale blocker but is not playback-approved.

A targeted new source request, `four-head-walk-opposite-prompt.txt`, specifies only opposite-leg phases02/03 for all views, with near/far-leg occlusion and anatomical right-hand preservation. The original successful source remains unchanged as evidence. Corrected output must be inspected, registered and re-reviewed; its generation alone does not clear the gate.
