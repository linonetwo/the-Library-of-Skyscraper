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

### Targeted correction candidates

All three targeted requests completed on their first attempt, with originals/prompts retained:

- `four-head-walk-opposite.png`, 1,072,817 bytes: 16 opposite-half candidates. Independent source inspection allowed S/SW/W/NW into assembly review, rejected repeated N and did not accept the entire right-facing group indiscriminately.
- `four-head-walk-right-views.png`, 1,502,272 bytes: six NE/E/SE candidates. Independent inspection allowed NE02, E02/E03 and SE03 into assembly review; NE03 still lifted the far leg and SE02 still led with the near leg. Apparent gradient background in the image viewer is hidden RGB under alpha0, not an opaque scene.
- `four-head-walk-ne-se.png`, 1,225,120 bytes: only the two rejected poses requested again as a targeted correction. Output still failed the specified near/far relationship and is **not consumed** by the pipeline. Retained as unsuccessful production evidence; no further repeated requests were made.

`four-head-walk-poses.mjs` selects accepted candidate cells, restores the original same-direction head rows to preserve identity, and registers only the new below-neck anatomy. N uses the independently permitted **symmetric neck-down body reflection** candidate: head/hair/outfit/staff remain unmirrored and the anatomical right-hand grip is re-registered from the exchanged limb. It does not mirror a completed character or switch weapon hand.

For the two remaining NE03/SE02 failures, `four-head-leg-repair.mjs` cuts generated leg pixels into explicit masks and re-roots/recomposes them around hip/knee joints: NE lifts the near leg while the other leg supports behind; SE uses a rotated generated thigh patch joined to the rear lower leg while the forward leg is rendered behind it. Feet keep their direction. No neutral pose translation or synthetic stick limb replaces the generated artwork. Masks, transforms and source selection are code/recipe-visible. These repaired joints and near/far contours are **candidates requiring independent visual review**, not claimed approved repairs. Original source files and refused cells are not overwritten.

First assembled right-view review found three concrete defects: NE03 mask included a triangle from the adjacent thigh; SE02 carried a dark shorts-edge fragment and narrow thigh; E02 was incorrectly registered to the forward far-side hand. The next candidate narrows the NE support-leg mask, removes shorts-edge fragments and widens the rotated SE thigh, and corrects E02 to the anatomical near-side rear fist at source `[68,250]`, moving staff/grip together without moving the body. The reviewer accepted that S/SW/W/NW and reflected N now show the other half-cycle, but noted unequal knee-lift/limb thickness between original and corrected halves. Continuous playback review remains necessary.

Independent v2 contact-sheet recheck cleared those three targeted blockers and permitted real-FPS loop review: E keeps the same near-side rear grip; NE's stray thigh corner is removed; SE's dark shorts cutout is gone. **This is not overall walk approval.** Remaining observations are NE hip/knee hard corners, SE thigh volume differences, asymmetric low/high knee lift and the01→02 arm transition. No additional whole-sheet generation is planned. All coverage remains prototype while the same committed assets enter the actual client.

### Playback-balance candidate after f642dce

Independent playback review of f642dce reported unequal E/W phase03 high knees versus phase01 low passing, thin corrected phase02/03 legs/boots, square NE03/SE02 shoulder/neck skin patches and a W03 neck-edge strip. The current candidate consumes only the already preserved successful sources; no new generation or prompt changes were made.

`four-head-walk-poses.mjs` finds the corrected source's narrow neck, registers its shoulder transition below the original same-direction head and retains the original central neck join (target rows57–63, columns84–108). `four-head-walk-balance.mjs` reposes the generated E/W03 thigh/shin around the hip to a lower passing knee/ankle, and widens corrected lower-leg alpha runs with a gradual blend (1.24× for E/W, 1.15× for other corrected views). These are explicit offline source-pixel corrections, not runtime deformation or new neutral-frame substitutes. Source-neck coordinates, width factor and passing-retarget description are recorded in the walk registration recipes.

Rebuilt runtime atlases, provenance, hand/staff registrations and equipment contact sheets accompany the candidate. Default `npm run build` now runs the current four-head animation pipeline; the old complete-image builder is retained only as `build:archive`. These changes address the reported locations but **have not received independent approval**; complete real-FPS idle/walk equipment review, limb volume/occlusion and shoulder/neck continuity remain open.

## 2026-11-18 — E/W source-joint passing candidate

Independent real-gallery / 8 FPS review of the 7d751a8 candidate still found W03/E03 horizontal torn/smeared contours around the knee and crossed shin, flattened boot detail, unequal 01/03 lift and flatter 02 legs/boots. The shoulder/neck blocks, W03 neck strip and E02 hand-side findings no longer reproduced; those registrations are deliberately unchanged.

The old side-passing routine cut and erased parts of an already registered 192px cell, leaving fragments; subsequent scanline-run widening amplified the fragments and interrupted the boot silhouette. That side-passing routine is removed. E/W no longer use `restoreLegVolume`. For phase02, the width correction is integrated into source registration (1.15× the former leg scale), so the source is sampled once instead of widening each alpha run after reduction.

`four-head-side-passing.mjs` now samples the preserved W03 (`four-head-walk-opposite.png`) and E03 (`four-head-walk-right-views.png`) thigh/shin/complete boot directly from their source crop with explicit hip/knee/ankle joints. Two-axis source masks, bone-local transverse scales and four subpixel area samples keep the generated surface and diagonal contours without smoothing the completed pose. Target knees are y130 for both side views; ankles y139, with complete raised boots ending near the phase01 raised-boot height. The original phase01 support-leg pixels are re-used at an integer horizontal offset behind the new near swing leg, preserving support boot detail and ground row172. This is an explicit limb assembly, not a mirrored character, translated idle or whole half-cycle stretch.

All source crops/joints, target joints, source support phase and transforms are recorded in `sidePassing` recipes. The torso, accepted head/neck join, original two first-half phases, hair/clothing sources, anatomical right-hand/staff attachments and other six directions remain unchanged. Both clothing options and all hair/weapon combinations are regenerated from the same shared body; there are no equipment-specific pose patches. No new image generation occurred on 2026-11-18, and all previously successful or rejected source files remain intact.

This is another **prototype candidate**, not independent walk approval. Review W/E 02→03→00 at actual 8 FPS, near/far support ownership, knee/shin seam, raised boot volume and both garment hems; regression-review the untouched NE/SE and idle combinations. Source/registration tests only establish reproducibility and contracts, not visual gait quality.

Production verification on 2026-11-18: `npm run build && npm test` succeeded (28 atlases ×32 cells, 23 tests passed). Decoded pixel comparison against 7d751a8 found changes only in W02/W03/E02/E03 of body and body-front; staff and hand-grip atlases are pixel-identical. All eight equipment contact sheets and four idle/walk comparison sheets were regenerated; full real-client independent review remains pending.
