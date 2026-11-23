#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
kind=${1:?parts or down}
group=${2:?front or back}
case "$kind" in parts|down);; *) exit 2;; esac
case "$group" in
 front) views='row 1 S: perfectly straight toward camera, down-screen, symmetrical front; row 2 SE: three-quarter toward camera and screen RIGHT, face opens lower-right; row 3 E: exact side profile toward screen RIGHT, nose/toes pointing directly right, just one eye visible';;
 back) views='row 1 N: directly AWAY from camera, up-screen, symmetrical solid back of hood, no eyes or chest; row 2 NW: three-quarter AWAY from camera toward upper LEFT screen, hood-back and back bookmark visible, no face; row 3 W: exact left-facing side profile, face and toes point directly screen LEFT, only one eye visible';;
 *) exit 2;;
esac
out="inkguard-six-$kind-$group.png"
if [[ -s "$out" ]]; then echo "Retained $out"; exit 0; fi
spec=$(<"six-$kind-template.txt")
exec bash /home/user/.codex/skills/proxy-imagegen/scripts/generate.sh --prompt "${spec//\{VIEWS\}/$views}" --out "$PWD/$out"
