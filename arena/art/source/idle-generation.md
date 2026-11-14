# Idle full paper-doll module — 2026-11-14

Status: **prototype**; release approval remains pending.

## Generation and shared-source boundary

Two successful invocations of the installed `proxy-imagegen/scripts/generate.sh`, current configured Responses provider and GPT Image 2, produced:

- `idle-body.png`: eight newly drawn, relaxed standing views, 2 columns × 4 rows. Both feet are planted; this source is not copied from a walk frame.
- `idle-outfits.png`: sixteen newly drawn garments, scholar in the left column and warden in the right, eight direction rows.

Exact text inputs are preserved in `idle-body-prompt.txt` and `idle-outfits-prompt.txt`. Both invocations succeeded on their first attempt; the configured maximum of two attempts was not exhausted. No successful source was regenerated. Text-only generation, no reference upload. No credentials, endpoints, or response payloads are retained. Source and prompt SHA-256 values are emitted in every corresponding provenance JSON.

Existing successful GPT Image 2 artwork is intentionally shared for the two hair designs and staff: column 0 of each direction in `walk-hair-ivory.png`, `walk-hair-midnight.png`, and `walk-weapon-staff.png`. Their walk-frame animation and body trajectories are **not** reused. Dedicated idle crown and hand registration places those designs on the newly generated standing body. This is the documented low-amplitude-action reuse boundary.

## Animation and packaging

`idle-pipeline.mjs` holds common transparent-cell packing, premultiplied-alpha resampling, upper-body breathing, and foreground hand extraction. `prepare-idle.mjs` owns source crops, directional placements, per-frame registrations, shared-source transforms and previews.

- Direction order: S / SW / W / NW / N / NE / E / SE.
- Four 250 ms phases: rest, inhale, full breath, exhale; looping at 4 fps.
- 192 × 192 cells with 2 px padding, atlas 784 × 1568, anchor `(0.5, 0.9)`.
- Upper body rises by 0 / 0.8 / 1.35 / 0.55 pixels. Slight chest expansion, delayed hem movement, and delayed hair-tip sway give four distinct frames per logical layer.
- Body pixels from y=132 down are bit-identical across all four phases. Boot soles end at y=172, immediately above the shared reference baseline y=173.
- Dedicated hair back/front masks put outer hanging locks behind the body and bangs/cap in front; aggregate hair atlases remain available for compatibility.
- Staff is independently registered to the standing right hand; NW/N/NE/E use rear depth, S/SW/W/SE use front depth. Foreground body hands restore skin and outlines over clothes/staff.
- Every produced atlas has a PNG, Pixi JSON, provenance JSON and source-side per-frame registration JSON. `idle-registration.json` and `idle-weapon-staff.attachments.json` expose frame timing, crown/neck/hips/both-hand attachments, and staff depth.
- Thirteen atlases: six logical layers, body-front, two staff depth layers, and four hair depth layers. Eight composite previews represent 2 outfits × 2 hairstyles × bare/held staff; these are **asset contact sheets**, not runtime evidence.

Rebuild: `npm run build:animation` (walk then idle, preserving both in coverage), or `npm run build:idle` for idle-only iteration. `npm test`: 14/14 passing after a clean full rebuild. Tests verify logical coverage, distinct phases, transparent borders, source/output hashes, fixed feet, split-layer reconstruction, timings and attachment metadata.

## Visual self-review and remaining work

- All eight views were reviewed in scholar/midnight/staff and warden/ivory contact sheets. New poses have straight planted legs rather than a walk contact pose. Skin/charcoal base, warm dark outlines and existing hair/staff preserve the established anime art direction.
- Scholar's teal center and ivory side panels are intentionally front-only; its ivory back carries a teal book emblem. The lighter back is not a missing clothing overlay.
- NW staff was corrected from the near-side left silhouette to the right-hand x=116 attachment. Midnight hair width was expanded by 6 px to cover exposed bald-head edges in oblique views.
- The newly generated standing body is closer to the requested three-head proportion than the older walk source. The old walk head is visibly larger, and its stance is wider. Switching actions therefore still has a proportion/volume discontinuity; harmonizing the older walk source requires a separate reviewed normalization pass, using a separate reviewed normalization pass.
- Hands touch the shaft, but a fully wrapped gripping-finger pose is not yet painted. Fine scalp/ear edge coverage, profile/back transitions, exact three-head measurement, and cloth/sleeve overlap still require human art approval.
- Runtime combination selection, idle/walk switching and screenshot evidence are handled in the client integration work. Runtime approval remains pending.

Coverage honestly marks all 48 idle logical direction rows `prototype`, with `releaseApproved: false`. Other unproduced actions remain `missing`.

## Final implementer self-review

The art implementer reviewed the final real-client, two-outfit screenshot `wiki/tiddlers/竞技场2026-11-15待机纸娃娃实机.png` and independently read `ActorView.ts`, `walkLayers.ts`, and `AnimatedDollPreview.tsx`. This is an **implementer self-review**.

Observed screenshot silhouettes, facing directions, scholar back emblem, warden armor and rear staff positions agree with the composed asset sheets. Runtime idle order is rear staff → rear hair → body → outfit → front staff → foreground hands → front hair, matching `prepare-idle.mjs`. Action-prefixed texture keys select independent idle assets; the sprite pool updates texture/order and hides surplus sprites when switching weapon/action combinations. The lab uses the same layer selector for DOM composition. The screenshot shows visible composition; client integration tests cover runtime animation switching.

The final full `npm run build:animation && npm test` was rerun by the implementer: 14 tests passed, zero failures. No generated walk file changed; coverage continues to record 96 prototype direction/layer rows and zero approvals. The client reviewer was asked to align the lab's initial idle playback speed to 4 fps (the authored 250 ms timing) and its visible labels to the selected action. The art limitations above remain open.
