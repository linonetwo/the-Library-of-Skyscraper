# Modular isometric tiles — 2026-11-17

Prototype only. These are separate floor and object PNG assets, not a flattened map.

Two calls to the installed proxy-imagegen Bash script/GPT Image 2 completed on the first attempt: `iso-floors.png` (1,433,859 bytes) and `iso-props.png` (1,557,672 bytes). Exact text-only prompts are adjacent `*-prompt.txt`; no reference uploads, response payloads or credentials are retained. Both original source files are preserved unchanged.

`node prepare-tiles.mjs` crops the four floor sources, removes near-white background and disconnected noise, resizes the generated texture and enforces an exact 128×64 diamond support. An 8%-wide common sandstone edge and short interior blend guarantee matching perimeter pixels; interior artwork remains generated texture. The 3×3 seam preview has no transparent cracks. The four variants share identical geometry.

The prop source did not obey equal-height rows: bookcases extend below the nominal 50% divider. Its authored crop boundary is 55%; this preserves shelf feet and separates the plinth/lectern. Largest connected alpha components remove generator chroma specks. Each prop is aspect-preserving fitted into a 128×192 transparent cell, base bottom y184, ground center pivot `(64,160)`. Floor pivot is `(64,32)`. No PNG total height is interpreted as tileHeight; every footprint is 1×1 with 128×64 ground geometry.

Outputs: `public/assets/tiles/manifest.json`, `floors.png/json`, `props.png/json`, and eight named standalone PNGs. Source/atlas/prompt hashes, crop rectangles and placements are reproducible through source-side registrations. `tiles.test.mjs` checks geometry, common edge texels, dimensions, pivots and hashes. No gameplay room labels, selection outlines or live values are baked in.

Visual self-review: four isolated tile textures, two dedicated shelf views, plinth and lectern are readable; no original map was used. The pale stone intentionally has very subtle seams. Tall-object pivot/depth and alpha edge quality still require actual runtime inspection with actors before approval. Runtime/independent reviewer evidence is not supplied by the contact sheets.
