# Idle / walk proportion and closed-grip slice — 2026-11-15

The idle standing anatomy is the scale reference. Walk retains its 32 original generated body poses; no idle body pose replaces a walking phase.

## Sources and construction

- Original body source: `walk-body-eight-directions.png`, unchanged. `normalize-walk.mjs` registers each head/neck, torso, hip and sole to the idle reference with a continuous piecewise transform. Actual leg separation, lifted feet, bent knees and arm swings remain.
- Both actions now use the same generated costume designs from `idle-outfits.png`. Walk has four independent shoulder-twist/hem-lag phases; this removes the previous costume-design change when crossing from idle to walk. Existing walk outfit generations remain as historical sources, not the final normalized outfit input.
- Both walk hairstyles retain their four original directional source pieces, registered to the same crown size as idle. Staff keeps its directional artwork and walking carry angles, with grip coordinates transformed together with the body and scale adjusted to the idle staff.
- New `grip-hands.png`: eight directional closed anatomical right-hand views, generated through the installed proxy-imagegen script and GPT Image 2. One request succeeded on its first attempt. Exact prompt: `grip-hands-prompt.txt`; no image reference was uploaded, and no successful source was regenerated.
- Grip views are not mirrored. Each is reduced to a compact fist with short wrist, rotated to the walk staff angle where applicable, then subpixel-registered to the corresponding shaft contact. Fingers paint over the shaft while it remains visible above and below the fist.
- Idle W/E and oblique hand contacts were measured again against the actual skin silhouette; the former W x88 / E x105 registrations were corrected to W x97 / E x94 to avoid adding a fist beside an existing open hand.
- Idle E uses a 14° carry angle with the same rear-depth rule, so the staff ornament and lower shaft remain readable outside the side-body silhouette; its fist follows that angle.
- Runtime close-up review corrected walk S/01 and S/03 source-cell hand centers to `[74,120]` and `[85,114]`. These authored staff tracks are mapped through body normalization before placing the closed-grip layer, moving shaft and fist together onto the existing palm; body and empty-hand sources remain unchanged.

## Measured change

Measurements use the alpha silhouette from crown to neck, not hair volume. Across 32 walk frames:

| Measurement | Previous walk | Normalized walk |
| --- | ---: | ---: |
| Mean absolute head-width difference from idle | 4.0625 px | 0 px |
| Mean absolute head-height difference from idle | 10.4375 px | 0.25 px |
| Mean crown-to-sole / crown-to-neck height ratio | 2.556 | approximately 2.84 |
| Opaque sole row | 176–183 | 172 |

Front S/00 head changes from 67×66 to 62×56 px, matching the standing head reference. The torso horizontal scale is 0.82 at the shoulder/hip region and blends to the head and leg transforms; natural swinging-arm and stride widths are preserved rather than forcing the entire walking silhouette into a standing outline. These are near-three-head anatomy measurements, not an assertion of an exact three-head artistic approval.

## Contract and reproducibility

Existing 192×192 cells, 2px padding, anchor `(0.5, 0.9)`, eight directions and four frames are unchanged. New `idle-hand-grip` and `walk-hand-grip` atlases use the same key contract. They are **weapon-only**, above body-front/staff and below front hair; bare-handed rendering does not show them. Both staff attachment manifests now include this order.

`walk-registration.json` records 32 before/after head/body bounds and mapped crown/neck/hip/right-hand positions. Each final normalized layer has its own source-side `*-normalized-registration.json` and matching recipe hash. Both grip layers have 32 source crops, placements, subpixel offsets, carry angles and source-view entries. Final provenance and coverage point to the actual shared costume source, not the earlier walk costume generation.

Rebuild with `npm run build:animation`; test with `npm test`. Eighteen art tests cover the existing module plus measured proportion alignment, exact reference sole, retained distinct body poses, shared costume source/four motion phases, finger–shaft alpha overlap, and registration hashes.

`motion-previews.mjs` renders 16 action/outfit/hair/weapon sheets and four `idle-walk-*-comparison.png` sheets. Each comparison row shows idle-rest followed by all four walking poses. These sheets support visual alignment review; they are not runtime screenshots.

## Remaining visual review

The new closed fists are small in the 192px cells; thumb/wrist joins and rear-facing grip anatomy still need human art approval. Some original NW/NE walk passing poses turn more directly away than their contact poses; proportion normalization preserves that existing direction drift. The art remains prototype. Runtime action switching and the weapon-only layer selection are checked separately by the client integration.
