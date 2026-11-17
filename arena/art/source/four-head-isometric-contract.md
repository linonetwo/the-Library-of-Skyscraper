# Four-head layered characters / 2:1 isometric tiles

2026-11-17 scope correction. Design contract, not generated or approved art.
Supersedes the old three-head proportion target; old successful sources remain historical prototypes.
Frozen version scope: v0.2.0 migrates idle/walk only; run is deferred to v0.3.0 candidate. Any run contract below is future reference, not this version's required output.

## Character source and runtime contract

- Keep 192×192 transparent cells, 2px atlas padding, anchor `(0.5,0.9)` / ground pivot `(96,172.8)`. Map and preview use the **same composed layers**, uniformly scaled as a whole. No complete dressed portrait replaces the doll, and no map-only stretching.
- Four-head unit is measured on the neutral anatomy, excluding hair: skull crown y12, chin y52, sole y172 = 160px / 40px. Head width approximately 38–42px. Neck y56, shoulders y62, waist y94, hip y112, knees approximately y142. Bent joints, lean and flight retain these segment proportions, not a forced 160px bounding box in every pose. Hair may extend above crown; flight feet are above the shared ground pivot.
- Start with an eight-view neutral **base-body-only** source: same face/skin, charcoal undershirt/shorts/boots, no hair/outer outfit/weapon. Approve the neutral anatomy and layered outfit fit before expanding the independent walk/run poses. Do not use a newly generated dressed full-character picture as a source for the preview.
- Scholar and warden remain separate transparent garment sources with their existing designs. Hair ivory/midnight and staff retain their designs and can reuse the existing directional artwork, resized and re-registered to the new crown/ear/hand tracks. Never mirror the right-hand weapon or asymmetric design. Forearms/hands are extracted from each matching base pose; closed fingers are a weapon-only layer, registered to the same shaft contact, not a second hand beside the original.
- Direction order `S SW W NW N NE E SE`; key `{action}/{layer}/{direction}/{00..}`. Idle 4×250ms, walk 4×125ms, run 6×(1000/12)ms. Run has independently drawn forward lean, alternating bent-arm swing, contact/push-off/flight for each leg, not accelerated or vertically shifted walk.
- Fourteen atlases for each new action: body, body-front, outfit-scholar, outfit-warden, hair-ivory/midnight aggregate and each front/back split, weapon-staff aggregate/front/back, hand-grip. Existing idle/walk must migrate with the same proportion contract; do not mix old three-head idle with four-head run.
- Composition: staff-back → hair-back → body → outfit → staff-front → body-front → hand-grip → hair-front. Staff and grip are omitted for empty hands. Per-frame depth can select/split the staff independently of direction when the arm crosses the torso.
- Registration records source hash/crop, anatomical scale, crown, neck, hip, both hands, both feet/contact flags, ground pivot, duration and occlusion split. Each layer keeps source/recipe hashes and reconstruction scripts. Source art and contact sheets are not runtime evidence.
- Approval gate: measure the neutral four-head anatomy; inspect all directions and all 2 outfits × 2 hairs × 2 weapon modes, then all authored frames in the actual shared doll renderer. Review scalp coverage, collar/wrist joins, finger/shaft contact, planted foot/sliding, flight, directional continuity and layer occlusion. Until evidence exists, keep `prototype`/`releaseApproved:false`.

## Isometric source contract

Art supplies individual transparent sprites, never another flattened full-map illustration. Sol owns projection/layout/camera/picking/depth. First slice has only z=0 walkable ground; decorative foundation height does not invent a floor.

| Asset | Source/export | Ground pivot / footprint | Construction |
| --- | --- | --- | --- |
| Floor top | 128×64 PNG | `(64,32)`, 1×1 | Diamond vertices `(64,0) (128,32) (64,64) (0,32)`; alpha outside; shared edge texels. |
| Low floor edge/foundation | separate strip sprite | explicit pivot matching adjoining tile | Vertical decorative face, not part of tileHeight and not a walkable level. |
| Bookshelf/wall section | up to 128×192 PNG | e.g. `(64,160)`, 1×1 | Ground diamond spans y128..192; artwork above; metadata always records actual pivot. No painted floor or cast shadow extending into neighbours. |
| Plinth/resource prop | separate PNG | explicit ground center, 1×1 | Same light direction/palette; visual resource identity remains separate from live UI numbers. |

Initial floor family: warm pale library stone base, restrained worn variant and a dark border/inlay variant with matching edges. Tall props: bookcase sections in the two iso axes, corner/end sections and low plinth. Warm dark outlines, restrained painterly shading and readable silhouettes match the anime dolls. No baked room labels, portraits, resource quantities, paths, selection rings, characters or UI.

2:1 isometric top-plane camera is fixed for every tile/prop. Floor edge continuity is authored/tested on a repeated 3×3 grid, not assumed from one diamond. Generated tile art may need crop, alpha cleanup and exact diamond masking before packing. Tall multi-tile bookcases/walls are split into single-footprint sections so actors can sort behind/in front by ground-foot y. Transparent PNG total height is never used as tileHeight.

Tile manifest entries: id, atlas frame, `tileSize:[128,64]`, `footprint:[1,1]`, `pivot:[x,y]`, kind (`floor`/`edge`/`prop`), source/recipe hashes, prototype status. A floor atlas and a separate props atlas may share the same manifest. Ground/top/vertical face layers remain separate.

## Existing generation results retained, not continued

The three former run requests have completed; no generation process remains live:

- `run-body.png`: first attempt success, 1,656,817 bytes.
- `run-outfit-scholar.png`: first attempt success, 1,807,377 bytes.
- `run-outfit-warden.png`: first attempt SSE/connection interruption; script's second attempt success, 1,417,443 bytes.

Exact prompts are sibling `run-*-prompt.txt` files. All used the installed proxy-imagegen script and GPT Image 2, text-only input; no credentials or response payloads retained. Body/scholar contain near-white backgrounds; warden has alpha with edge contamination. They were inspected but **not** packed, registered into coverage, committed as delivery, or granted approval. They target the superseded three-head request and are historical production evidence only.
