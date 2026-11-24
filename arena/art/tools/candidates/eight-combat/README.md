# Eight-direction player combat pose candidates

Offline independent body, outfit, hair and hand/staff layers. These outputs do not register actions with the game, and remain unapproved until the independent art review is recorded.

Attack uses preparation 150ms, contact 90ms, follow-through 180ms and recovery 180ms. Six new headings use their accepted idle anatomy and independent limb IK; the existing NE/SW attack pages are copied unchanged. The contact and follow-through wrists/staff differ, with a 5px retraction and 10° return. Weapon-off remains an open-hand gesture candidate, not a completed punch.

Hit uses recoil 120ms and recovery 240ms; the feet stay planted, torso/shoulder recoil and reachable wrist positions are coupled. Existing NE/SW hit pages are copied unchanged.

Down uses knee flex 150ms, supporting palm 180ms, side-hip impact 180ms and grounded hold 600ms. Each limb is solved in world coordinates, then projected into the existing camera. Head, torso, two outfits and both front/back hairstyles switch to independently sourced grounded parts for the impact/hold. The boots retain their own ankle-to-floor projection, the impact hip/shoulder remain higher than the final hold, and final hands rest beside the torso. These clips use the 256px canvas and pivot `[128,204.8]`; world size and render scale remain unchanged.

Rebuild from the repository root:

```sh
node arena/art/tools/candidates/eight-combat/build-combat-poses.mjs E,W attack,hit
node arena/art/tools/candidates/eight-combat/build-combat-poses.mjs N,S,NW,SE attack,hit
node arena/art/tools/candidates/eight-combat/build-down-poses.mjs NE,SW,E,W,N,S,NW,SE
node arena/art/tools/candidates/eight-combat/merge-combat.mjs attack,hit,down
node --test arena/art/tools/candidates/eight-combat/combat.test.mjs
```

`merged/<action>/atlas-budget.json` is the only clip descriptor, with page filenames, timing, registration, coverage and per-direction layer ordering. No alternate runtime format or renderer is introduced. Per-batch `pose.json`, contact reports, eight appearance sheets and loops are review artifacts. Down additionally records actual world support joints and uses explicit projected joints/attachment mappings in the same pose exporter.

Source/grounded registration is maintained independently by the art owner in `ART.md`, `register-grounded.mjs`, `source/` and `grounded/`. Bake scripts do not edit those inputs. The source commit must be present before reproducing the grounded clips.
