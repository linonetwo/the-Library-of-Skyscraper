# NE/SW sixteen-phase world walk candidate

Rebuild from the repository root:

```sh
node arena/art/tools/pose-export.mjs arena/art/tools/candidates/ne-sw-walk-16/pose.json /tmp/arena-walk16
```

The sampled `pose.json` is the authoritative frozen input, including all sixteen upper-body target poses and world leg phases. Each export re-solves the world legs and explicit arm targets. Shared registered attachment PNGs are in `../../sources/ne-sw-registered`; no other checkout, generated full-character image, service or API is needed.

Sixteen 45ms phases form a 720ms cycle at 1.5 world units/s and 1.08 units/cycle. Each leg preserves world segment lengths .3187701178/.3060520193; hipZ .66, ankleZ .11, track width .18. Projected bone-axis mapping changes apparent length, with source/target endpoints reported when rebuilt; thickness and boot shape remain unchanged. Both support soles are audited across two cycles, including support switches and the seam. The sprite-hold displacement bound is still 4.83 screen pixels; numerical keyframe foot lock does not imply continuous perfect contact.

Thirteen independent active layers support scholar/warden, ivory/midnight hair and natural-hand/staff choices. `output/atlas-budget.json` is the unique clip descriptor and page budget. All pages are alpha-trimmed with original 192×192 canvas, normalized ground pivot (.5,.9), 2px extrusion and maximum dimension 2048. Empty layers are omitted. Registered natural hand follows the forearm angle; gripping hand and staff share the explicit wrist angle and grip point.

Art accepted the layered contact pages for an eight-second product-renderer review, not final natural-motion acceptance. Review SW phases 2–4/11–13 knee occlusion, NE phases 2–4 shoe outlines and SW staff-tail/front-foot proximity. Generated reports, eight-look GIFs and full diagnostic pages can be regenerated; the development evidence is `/home/user/arena-v030-atlas-evidence` and is not a build dependency.
