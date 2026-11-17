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
