# P3 independent environment pieces

Status: **prototype; not release-approved**. These are individual bitmap sprites, never a baked room/map backdrop. No client or authoritative map files are changed by this package.

## Camera and consuming the assets

`screen = (64(x-y), 32(x+y)-78.3837z)`, orthographic yaw 45°, elevation 30°, 1 world unit = 1 metre. All delivered sprites are pre-sized for **runtime renderScale 1**. `sourceScale`/source transforms record offline processing only. `pivot` is the **ground footprint centre**, not image centre or frontmost corner; `anchor = pivot/canvas`.

`assets/manifest.json` follows the existing `iso-v030-world/manifest.json` `assets[key] = {image, canvas, pivot, anchor, ...}` shape. A future client integration can copy these PNGs and merge entries into its world registry, then use `worldSprite`. The existing `mapScene` bookcase path hardcodes the 128×192 shelf anchor; do **not** feed new pieces through that path without making it registry-aware.

Each asset includes an explicit world-space footprint, decoration occupation, height, `renderScale`, and floor/prop layer. The flat threshold and inset are **walkable decals**, not collision. Low-wall decoration should be restricted to server-provided perimeter decor slots; do not invent a collision wall in the art registry.

| Asset | Canvas | Ground pivot px | Footprint m | Height m |
| --- | --- | --- | --- | --- |
| low-wall-u | 148×100 | 74,62 | 2×0.22 | 0.30 |
| low-wall-v | 148×100 | 74,62 | 0.22×2 | 0.30 |
| threshold-u | 156×80 | 78,40 | 2×0.35 | 0 |
| threshold-v | 156×80 | 78,40 | 0.35×2 | 0 |
| target-inlay | 260×132 | 130,66 | 2×2 | 0 |

There is intentionally **no scalar `sourceScale`** for this batch: each painted face is sampled from registered source quadrilaterals into exact projected world vertices. All transforms are **already baked into PNGs**, so runtime scale is exactly 1. `sourceFaces` retains all source pixels and world target vertices for deterministic reproduction; the geometry is not guessed from cropped image bounds.

## Placement contract

- Retain the centre 3×4 = twelve formation positions and 3-wide through-route. The reference composition deliberately keeps those open; it is a layout study, not authoritative room placement.
- Low walls are 0.30m high (23.515px vertical), below the 0.35m maximum. No tall posts, foreground railings or independent pillars.
- Two-world-unit thresholds are flat: the threshold itself creates no choke or collision. On a three-wide route it is a centred two-wide visual accent, with the entire three-wide route remaining traversable. It must not be implemented as a two-wide cut in authoritative navigation.
- The 2×2 target inset belongs beneath the **existing** catalogue target and renders before props/actors. Do not move the interaction point to match this art.
- Base: reuse the existing plinth/warehouse marker, use ordinary stone and sparse brass/walnut perimeter.
- Resource: reuse `resource-cache` and `floor-worn`/`floor-cracked`, with two or three **decorative** sparse stacks outside reserved positions. Do not imply extra harvestable nodes.
- Target: existing lectern on the pale-gold inset, existing u/v shelves behind it.

## Reuse and review

Existing tiles, shelves, plinth, lectern and resource-cache are reused in the composition previews without modifying their sources. Existing resources retain their own approval state; this package does not reapprove them.

The successful GPT Image 2 source and exact prompt are retained under `source/`; no keys, provider URLs or response payloads are committed. The proxy-imagegen skill was explicitly requested. The source is generated once successfully, then processed deterministically. Ground registration and alpha treatment are documented by `build.mjs` and `assets/manifest.json`.

Pending gates: independent art review, actual client placement against server reserved/decor slots, actor/interaction overlap review, gameplay screenshot, and explicit release approval. Offline source/alpha/projection/contact-page inspection is **not** actual client approval.

Review record, 2026-11-22:

- Source author visually inspected the successful source, contact page, and assembled 7×7 studies. The generated background/lighting halo was excluded completely using registered surface polygons; world-axis slopes were corrected with piecewise-affine resampling.
- Main agent visually inspected the five-piece contact page and three-room comparison and accepted the projection, low-wall height and colour as **product integration candidates**. This is not release approval.
- Automated checks: five canvas/anchor/alpha-margin registrations, maximum height, walkable floor layers, non-collision decoration and prototype flags pass.
- Source author's actual runtime review: **pending** until the integrating agent supplies screenshots. Final screen acceptance remains with the main agent.

## Rebuild

From `arena/art`, install the existing locked dependencies (`npm ci`) and run:

```sh
node p3-environment/build.mjs
node --test p3-environment/environment.test.mjs
```

The script only writes this package's `assets/` and `review/` directories.
