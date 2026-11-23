# P3 warehouse and defence-tower upper modules

**Prototype, not release-approved.** Two independent bitmap upper modules; no baked building scene and no client, protocol, collision or authoritative map changes.

## Reuse and render contract

- Preserve the existing `tiles/plinth.png` as the lower stone pedestal. The new opaque module covers its teal crystal; the original core continues using that crystal unchanged.
- Preserve `tiles/lectern.png` for cataloguing and the existing `construction-site-back/front` sprites for construction. These sources are not regenerated.
- Draw `plinth → upper` inside the existing building node at its authoritative world position. For unfinished buildings keep the existing construction-back/building/construction-front ordering.
- `assets/manifest.json` uses the existing world asset shape (`image`, `canvas`, `pivot`, `anchor`). Both upper sprites have the **same ground origin as the underlying plinth**, not an anchor at the bottom of their visible module.
- All resizing and registration are baked into the PNG. Runtime **renderScale=1**. Do not apply the offline source transform a second time.
- The client integration selects the upper module over the retained plinth and removes that tower placeholder. The client reads the packed atlas and manifest attachments at runtime.

Camera: `P(x,y,z)=(64(x-y),32(x+y)-78.3837z)`, yaw45°, elevation30°, 128×64 ground tile, 1 world unit = 1m.

Current authoritative local `buildOffsets` (unchanged):

| Kind | Local x,y |
| --- | --- |
| core | -1.5,-1 |
| warehouse | 1.5,-1 |
| tower | 1.5,1 |
| catalog | -1.5,1 |

The existing renderer prefers `building.worldPosition`. Never move an interaction point to fit the art. Footprints in this package are visual occupation, **not new collision**; central formation positions and through-routes still follow the authority.

## Readability

Warehouse has a broad walnut storage/receiving silhouette with paper supplies, visibly distinct from the small pointed teal core crystal. The tower has a taller reinforced column and a pale-gold lens; its registered `muzzle` and `hitAnchor` are presentation attachment points, not attack-rule changes. A fixed source orientation is not an eight-direction tower animation.

## Production and review

The user-requested `proxy-imagegen` skill generated the retained source once successfully. Exact prompt and source remain under `source/`; no credentials, provider data or complete API response are stored.

`build.mjs` documents alpha/trim, baked transforms, inherited base alignment and atlas placement. `review/` contains a contact sheet and a direct core/warehouse/tower comparison over the existing base. Runtime review uses separately recorded actual game captures; offline images do not constitute gameplay or release approval.

Rebuild from `arena/art` with its existing locked `sharp` dependency:

```sh
node p3-buildings/build.mjs
node --test p3-buildings/buildings.test.mjs
```
