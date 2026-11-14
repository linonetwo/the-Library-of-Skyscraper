# Midnight walk hair — 2026-11-14

Generated using the user-selected `proxy-imagegen` skill / GPT Image 2, one successful request. Original raster and exact prompt are preserved in `walk-hair-midnight.png` and `walk-hair-midnight-prompt.txt`; no recoloring or reuse of ivory artwork.

`prepare-midnight-walk.mjs` extracts the largest blue/navy connected component in each source cell, removes neutral edge contamination, and registers 32 independently drawn poses to the existing ivory crown/ear-line coordinate contract. Direction order S SW W NW N NE E SE, four walk frames each; 192×192 cells, 2px padding, shared body anchor (0.5, 0.9). Source crop/placement coordinates and SHA-256 provenance are persisted. No new front/back split is needed for this ear-length bob; face cutouts are transparent, rear views are opaque caps.

Rebuild: `cd arena/art && npm run build:animation && npm test`.

Outputs: `arena/client/public/assets/animation/walk-hair-midnight.{png,json,provenance.json}`; composed scholar/warden staff contact sheets in `arena/art/walk-*-midnight-staff-preview.png`. Contact sheets are NOT runtime evidence.

Visual review: matching compact chibi crown volume and navy-indigo cel shading; source is hair-only, all eight directions present. SW/SE face cutouts and rear oblique poses remain prototype, along with existing body proportions and staff grip. No release approval claimed. Other animation modules (idle/run/jump/climb/staff attack/hit/death) remain missing.

Self-review: art tests pass 10/10, including 32 unique pixel hashes, fully transparent cell borders, shared body frame geometry, and source/atlas SHA-256 checks. Client TypeScript build passes. Two independent packing runs produced atlas SHA-256 `572de2cfbc1733b81aca5ce39b50eb7e9c3b24e6d7cb5cf786f12500086715dd`.

Runtime evidence procedure: with the client on port 5173 and Playwright Chromium installed, run `node capture-midnight-runtime.mjs`. It selects midnight hair, traverses all four frames in all eight directions with each outfit, checks 32 unique runtime positions per outfit, and saves a side-by-side pair of real client screenshots to `wiki/tiddlers/竞技场2026-11-14午夜发纸娃娃实机.png`. Runtime execution is a separate acceptance gate from asset tests.

Runtime execution on 2026-11-14: PASS scholar 32/32 and warden 32/32 midnight poses in the actual animation lab, with staff enabled; the side-by-side runtime screenshot was saved and visually inspected. Battlefield resource-loading integration is wired through shared `walkLayerNames`/`ActorView`; dedicated live battlefield movement acceptance remains separate.

Remaining work, in order: refine common body three-head proportions and NW/NE direction drift; review face openings and hair/crown registration on every outfit; refine held-staff finger contact; produce independent idle/run/jump/climb and staff windup/cast/recovery layers for every outfit/hair; add hit/death/get-up; exercise battlefield transitions and every equipment combination; final visual and release-rights approval. The present module does not claim any of those actions.
