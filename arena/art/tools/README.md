# Offline attachment pose export (prototype)

`node arena/art/tools/pose-export.mjs CONFIG.json OUTPUT_DIRECTORY`

Requires the existing art package's `sharp` dependency. Writes only the chosen output directory. It never modifies source art, client assets or release approvals. An export is an unapproved NE/SW study until the art reviewer accepts its contact sheet.

The input is versioned JSON:

```json
{
  "schemaVersion": 1,
  "cell": [192, 192],
  "groundPivot": [96, 172.8],
  "action": "walk",
  "renderScale": 1,
  "cycleWorldStride": [0.75, 0],
  "previewLayers": [
    "hair-ivory-back",
    "body",
    "outfit-scholar",
    "body-front",
    "hair-ivory-front"
  ],
  "directions": {
    "NE": {
      "joints": {
        "root": { "parent": null, "restOffset": [0, 0] },
        "hipL": { "parent": "root", "restOffset": [-5, -47] },
        "kneeL": { "parent": "hipL", "restOffset": [0, 22] },
        "ankleL": { "parent": "kneeL", "restOffset": [0, 23] }
      },
      "attachments": [
        {
          "id": "near-thigh",
          "layer": "body",
          "image": "NE/thigh.png",
          "joint": "hipL",
          "pivot": [8, 3],
          "zOrder": 2
        },
        {
          "id": "near-shin",
          "layer": "body",
          "image": "NE/shin.png",
          "joint": "kneeL",
          "pivot": [7, 2],
          "zOrder": 3
        }
      ],
      "feet": { "L": { "joint": "ankleL", "soleOffset": [0, 2], "bend": 1 } },
      "poses": [
        {
          "durationMs": 125,
          "joints": {
            "hipL": { "rotation": -12 },
            "kneeL": { "rotation": 25 }
          },
          "contactFoot": "L",
          "rootScreenDelta": [0, 0]
        },
        {
          "durationMs": 125,
          "joints": {},
          "contactFoot": "L",
          "rootScreenDelta": [2, -1]
        }
      ]
    }
  }
}
```

The new sample’s 192px transparent cell contains a roughly 132px crown-to-ground figure; cell size is not body height. Do not apply a second body-height normalization.

This deliberately incomplete example explains the interface; it is not approved animation artwork. A real NE/SW study supplies both complete independently authored directions and all four opposite support/swing phases. Phase 0/2 alternate the supporting foot and opposing arm. Source PNGs are transparent direction-specific limb, garment, hair and weapon attachments created by the artist; do not mirror one direction or invent missing direction coverage.

Coordinates are pixels, positive x right and y down; rotations are clockwise degrees, relative to the parent. Each joint's `restOffset` is measured from its parent in the parent's local frame. Attachment `pivot` is measured in the original attachment image; `rotation` optionally adjusts its registration angle. `zOrder` controls order within each output sprite layer; a frame's optional `depth` object overrides individual attachment order. Runtime inter-layer depth remains the established fourteen-layer order, so an attachment needing a different cross-layer depth must be assigned the appropriate front/back layer by the artist.

`rootScreenDelta` is the **cumulative projected screen displacement** of the actor root at that frame, not a per-frame delta. The artist derives it from world direction, speed, frame duration and the existing isometric projection. Do not reuse a constant screen stride across directions. The explicit positive `renderScale` converts atlas pixels to product screen pixels (the new registered 192px-canvas sample uses scale 1; the legacy actor scale was 136/192). The exporter divides screen displacement by this scale before atlas-space IK; the report records both spaces and their errors. `cycleWorldStride` documents world-space full-cycle motion for art/client agreement; it does not silently invent a direction projection. Knee/ankle positional offsets are rejected; use root/hip translation and joint rotations. Each support run plants a world-space sole point on its first frame. Subsequent frames subtract the moving root displacement from that plant point and solve the hip/knee/ankle chain; ankle orientation is preserved so the sole pivot does not rotate away. Unreachable targets fail explicitly rather than silently stretching limbs. `contactFoot: null` releases the plant. Each foot requires a two-segment chain and can select the knee bend sign.

Outputs use existing `frameName(action, layer, direction, index)` names and 192px cells/normalized ground anchor. Four 125ms poses match the existing walk runtime. Different modules or frame counts can be exported for study, but their runtime catalog must be integrated separately; per-frame durations are recorded in the report, not encoded as runtime playback changes. All fourteen layer PNG/JSON pairs are emitted; inactive layers are transparent. Only explicitly supplied directions are listed. This tool does not claim an eight-direction runtime replacement.

`pose-example.json` is an interface example with deliberately missing source images, not a runnable art substitute.

`footTargets` optionally supplies explicit atlas-space sole positions by foot ID for a pose. The exporter solves each requested leg before applying the ongoing support-foot world lock. These targets must come from reviewed contact/passing poses; an unreachable target fails without stretching source segments.

`contact-loop.gif` plays the selected directions together at the declared frame durations.

`contact-debug.png` adds phase/direction/support labels and a red sole marker. `contact-sheet.png` shows the selected appearance at actor-local origin. `contact-report.json` records root displacement, actual/planted world sole points, post-IK joints and numeric foot-lock error. Inspect both: zero foot-lock error does not establish believable anatomy, occlusion, contact timing, opposite limb action, seam continuity or a good loop. Loop closure also requires the final pose to transition into phase zero after the configured full-cycle world stride.
