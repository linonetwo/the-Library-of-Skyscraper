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
