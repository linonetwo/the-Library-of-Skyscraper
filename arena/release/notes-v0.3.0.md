# v0.3.0 local candidate

This recipe prepares a Linux local candidate with the production browser client,
local authority, isolated V8 runner, TypeScript compiler/SDK, and MCP dependencies.
Start the unpacked `package/start.sh` with ports 5173/8787 available and open the UI.
The candidate supports the first-expedition behavior modules, scripted publication,
version history and replay through the existing authority.

The manifest records actual packaged dist index/descriptor bytes, the provenance
record, dependency locks, module versions and build tools. Player actions come only
from `iso-v030-base/index.json`; enemy clips and ground/world/building/environment
entries are recorded separately. `FILES.sha256` covers the complete payload.

This recipe is not a frozen final source or release approval. The provenance record
separates offline source review from runtime integration review. At this metadata
handoff player work integration and player combat completion remain pending; later
source commits must update provenance to match actual reviewed runtime coverage.
Legacy animation coverage and v0.2 approval do not approve v0.3 main-scene actions.
The main development build's tick233 expedition victory is gameplay evidence only.

Final acceptance must rebuild one fixed source commit with a clean committed recipe,
verify checksums in a fresh extraction, and launch the actual package for victory,
defeat, dual-client, script/recovery and replay checks. Record those results with
sourceCommit, recipeCommit and archive SHA256 before tags or hosted publication.
