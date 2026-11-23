# NE/SW hit candidate

Two phases, 120/240ms, once. Upper body turns -4° NE/+4° SW around the pelvis during recoil; both world legs, soles and root remain fixed. Wardrobe, hair and hands/staff share this pose. Static product candidate; final dynamic acceptance pending.

Two independent outfits × two hair styles × weapon on/off are layered options, not eight whole-body atlases. `output/atlas-budget.json` is the unique clip descriptor, with exact timing, original canvas/pivot, active layers and pages. All pages are at most 2048 pixels.

Rebuild from repository root:

```sh
node arena/art/tools/pose-export.mjs arena/art/tools/candidates/ne-sw-hit/pose.json /tmp/ne-sw-hit
node arena/art/tools/preview-looks.mjs arena/art/tools/candidates/ne-sw-hit/pose.json /tmp/ne-sw-hit
```
