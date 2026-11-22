# Rear shelf placement · library-v3.3

Only `world-map.json` props and version change. Positions below are relative to
room center; u/v mean the existing bookcase-u/bookcase-v assets. Footprints are
1×1. Foreground receives no tall objects or extra props in this batch.

| Room | Local shelf anchors |
| --- | --- |
| 0, 1 (7×7) | u(-3,-3), u(-3,-2), v(-2,-3) |
| 3 (7×7) | u(-3,-3), u(-3,-2), u(-3,-1), v(-2,-3) |
| 2 (5×5, north entry) | u(-2,-2), v(2,-2) |
| 4, 5, 6 (5×5) | u(-2,-2), v(-1,-2), v(0,-2), v(1,-2), v(2,-2) |

Doorways follow every link segment, including paths through rooms 1 and 4.
Their two-tile clear corridor and the center 3×4 actor slots remain open;
shelves do not overlap the 1×1 building footprints at the existing ±1.5 offsets.
Touching footprint boundaries is allowed. Rooms, floor sizes, links, building
anchors and authority movement/collision remain unchanged.

Preview against a newly created session from a server built with this map:
inspect rooms 0/1/3 at default camera for the two joined rear shelf runs, then
room 2's open north doorway and room 4's east/south through route. Compare with
all 12 squad slots occupied and buildings present; verify the visible sprite
bases and silhouettes as well as their data footprints before visual acceptance.

## P3 low perimeter and floor accents (library-v3.4)

The 27 tall shelves remain unchanged. Twenty non-collision, 0.30 m low-wall
segments occupy the two visible front edges; their full footprints avoid the
three-tile-wide link corridors, including links passing through intermediate
rooms. Twelve two-tile floor thresholds mark the actual room/link crossings,
without narrowing those corridors. A 2×2 floor inlay sits under room-3's catalog
anchor (-9.5, 9). Rooms, links, standing slots and building anchors are unchanged.

The five `p3-environment` prototype assets retain their exported pixel anchors
and pre-baked scale 1. Floor markings render after tiles and before all depth
entities; low walls use the same footpoint depth ordering as other static props.
They add no collision. Existing decor-only replay migration applies.
