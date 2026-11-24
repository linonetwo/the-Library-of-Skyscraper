# v0.3.0 local candidate

This recipe prepares a Linux local candidate with the production browser client,
local authority, isolated V8 runner, TypeScript compiler/SDK, and MCP
dependencies. Start the unpacked `package/start.sh` with ports 5173/8787
available and open the UI. The candidate supports the first-expedition behavior
modules, scripted publication, version history and replay through the existing
authority. New sessions use simulation version 5 for separated combat positions,
retaining 500ms ticks and 750mm-per-tick travel speed. Replays from versions <=4
keep their original behavior; the earlier sim4 work and tick233 evidence remains
limited to its recorded version.

The manifest records actual packaged dist index/descriptor bytes, the provenance
record, dependency locks, module versions and build tools. Player actions come
only from `iso-v030-base/index.json`; enemy clips and
ground/world/building/environment entries are recorded separately.
`FILES.sha256` covers the complete payload.

This recipe is not a frozen final source or release approval. The provenance
record separates offline source review from runtime integration review.
Eight-direction collect/carry/unload/build/catalog integration now has a scoped
runtime review at PR85's exact source. Ground and world registration have a
scoped review of five actual main-work images from fe498340; this excludes
unseen towers, dynamic combat, all environment placements and whole-version
acceptance. Player grounded pose layers and frozen attack/hit/down inputs have
offline source reviews (PR92/93), which do not approve runtime combat playback.
PR96 corrects absent attack/hit back-hair layer registration without changing
poses or pixels; its approval is offline descriptor delivery only. PR95 reviews
MCP five-card controls, typed config rejection before mutation, version hashes
and candidate origin. PR101 corrects paused HUD wording after tick0 without
changing counterattack state or buttons. PR97 reviews the room-2 v3.5 decorative
shelf correction in matched-camera views, preserving paths and footpoints. PR98
adds scoped combat clip integration, observed-action loading, zero-vector
heading retention and paused late-down playback reviews. Its approval explicitly
excludes overlapping-combatant readability. PR100 separately reviews simVersion5
authoritative arrival spacing in normal and first-expedition AI counterattacks:
stationary feet remain separate and movement is capped at 0.75m/tick. This
excludes general avoidance; enemy/background contrast near shelving remains
lower. The observed AI run won at tick223. Full packaged acceptance remains
pending. Final provenance must follow their actual reviewed commits. Legacy
animation coverage and v0.2 approval do not approve v0.3 main-scene actions. The
main development build's tick233 expedition victory is gameplay evidence only.

Final acceptance must rebuild one fixed source commit with a clean committed
recipe, verify checksums in a fresh extraction, and launch the actual package
for victory, defeat, dual-client, script/recovery and replay checks. Record
those results with sourceCommit, recipeCommit and archive SHA256 before tags or
hosted publication.
