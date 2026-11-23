#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
case "${1:?front or back}" in
 front) views='row 1 S, worker facing straight toward viewer (down-screen), the folio upper page edge points down-screen, front parcel edge horizontal. Row 2 SE, worker faces down-right on screen, top of pages and long edge recede towards LOWER RIGHT. Row 3 E, worker faces directly screen RIGHT, tops of pages point screen RIGHT, page gutter runs horizontally left-to-right; parcel long side and near short side read in profile.';;
 back) views='row 1 N, worker faces exactly away from viewer (up-screen), folio top edge points UP-screen, near open pages seen from above. Row 2 NW, worker faces upper LEFT, top of pages points upper-left, page gutter and long packet axis follow this diagonal. Row 3 W, worker faces straight screen LEFT, top of pages points screen LEFT, page gutter runs horizontally left-to-right, parcel side-on with its near short edge towards screen right.';;
 *) exit 2;;
esac
out="work-props-$1.png"
[[ ! -s "$out" ]] || { echo "Retained $out"; exit 0; }
spec=$(<template.txt)
exec bash /home/user/.codex/skills/proxy-imagegen/scripts/generate.sh --prompt "${spec//\{VIEWS\}/$views}" --out "$PWD/$out"
