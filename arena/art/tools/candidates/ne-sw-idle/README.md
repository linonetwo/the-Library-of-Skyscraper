# NE/SW idle candidate

Four breathing phases, 400ms each, loop. Hip height is .700/.708/.700/.692m; the pelvis, upper body and wrists follow by 0/-.627/0/+.627 pixels. Both world legs are re-solved at fixed anatomical lengths to the same ground soles. No extra head rotation is applied, avoiding subpixel face/hair-edge flicker. Art accepted the layered contact pages as a product candidate; final dynamic acceptance is pending.

Two independent outfits × two hair styles × weapon on/off are layered options, not eight whole-body atlases. `output/atlas-budget.json` is the unique clip descriptor, with exact timing, original canvas/pivot, active layers and pages. All pages are at most 2048 pixels.

Rebuild from repository root:

```sh
node arena/art/tools/pose-export.mjs arena/art/tools/candidates/ne-sw-idle/pose.json /tmp/ne-sw-idle
node arena/art/tools/preview-looks.mjs arena/art/tools/candidates/ne-sw-idle/pose.json /tmp/ne-sw-idle
```
