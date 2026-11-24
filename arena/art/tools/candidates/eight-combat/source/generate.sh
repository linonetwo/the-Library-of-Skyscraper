#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
case "${1:?a or b}" in
 a) v='row 1 N: pelvis at screen bottom, neck and crown directly UP screen, camera looks from the boot end along the chest; row 2 W: pelvis on right, neck/crown directly LEFT, head and bodice broadside on ground; row 3 NW: pelvis lower right, neck and crown upper-left (slope +0.5 when screen y points down), a different diagonal ground view.';;
 b) v='row 1 S: pelvis at screen top, neck and crown directly DOWN screen, camera sees crown side FIRST and then shortened torso, neck interior visible; row 2 E: pelvis on left, neck/crown directly RIGHT, head and bodice broadside on ground; row 3 SE: pelvis upper left, neck and crown lower-right (slope +0.5 when screen y points down), independent diagonal ground view.';;
 *) exit 2;;
esac
out="grounded-$1.png";[[ ! -s "$out" ]] || exit 0
spec=$(<grounded-template.txt)
exec bash /home/user/.codex/skills/proxy-imagegen/scripts/generate.sh --prompt "${spec//\{VIEWS\}/$v}" --out "$PWD/$out"
