# v0.4.1 local candidate

This patch makes the AI module workbench visible from the home screen. A new
player can inspect and edit the paused squad before starting training. Existing
graph and handwritten TypeScript drafts retain their own content; normal training
and online entry remain available.

Linux x64 requires Node.js 24. Extract and run `./start.sh`; default web/authority
ports are 5173/8787, configurable through ARENA_WEB_PORT and ARENA_PORT.

When the manifest contains runtimeReuse, this package reuses the v0.4.0 Rust
binaries and unchanged Node dependencies from the source recorded there; only
the client is rebuilt. External evidence records the reused file hashes and exact
unchanged source/lock comparison. Without runtimeReuse, manifest.binaries records
the full build profile. The manifest always records the current source/recipe.
Inherited graph and asset approvals keep their original scope.

Targeted fresh-user entry, saved graph/TypeScript draft recovery, training and
online smoke checks apply to this patch. Full v0.4 G5 evidence remains associated
with the original v0.4.0 archive. Candidate metadata does not approve publication;
root acceptance of the actual patch package precedes any v0.4.1 tag or release.
