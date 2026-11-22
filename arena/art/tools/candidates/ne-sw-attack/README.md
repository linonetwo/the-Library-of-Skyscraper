# Ordinary staff attack — NE/SW prototype

Reproduce: `node arena/art/tools/pose-export.mjs arena/art/tools/candidates/ne-sw-attack/pose.json /tmp/arena-attack-study`, then `node arena/art/tools/preview-looks.mjs arena/art/tools/candidates/ne-sw-attack/pose.json /tmp/arena-attack-study`.

Four semantic phases: preparation150ms,contact90ms,hold180ms,recovery180ms. `output/atlas-budget.json` is the same clip descriptor used by walk, with `playback: once` and exact `frameDurationsMs`; sourceSize192/pivot[96,172.8]/renderScale1. Both world feet remain fixed at standing hipZ.70/ankleZ.11/track.18. No authority-root movement is introduced. All wrist targets are reachable; both sole world points are identical across four poses and registered palm/shaft contact residual is0.

Staff/gripping palm consume the independently registered absolute attachment angle; forearm and near sleeve use the arm pose. Natural palm and gripping palm are mutually exclusive. Thirteen independent layer atlases support two outfits/two hair styles/weapon states; combined contact sheets/GIFs are review-only. Source anatomy is not rotated as a whole sprite or replaced by a full-character generated action frame.

Art inspected the two-direction contact page and all eight appearance combinations and accepted freezing an ordinary staff attack product candidate. Weapon-off uses an open natural hand: explicitly an `unarmed gesture candidate`, not a complete unarmed punch. Natural combat quality and actual cue playback/pause/replay remain product-review gates. This is not the future full chant/spellcast module.
