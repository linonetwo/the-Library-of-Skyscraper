# Rebuild a local candidate

From a checkout containing this command, run:

```sh
node arena/release/build.mjs 0.2.0 SOURCE_COMMIT /absolute/new/output
```

Replace `SOURCE_COMMIT` with the frozen v0.2.0 commit containing `arena/art/approval-v0.2.0.json`. The package includes that approval record at the same path and records its SHA256 in the manifest. Rebuilding v0.1.0 uses its contemporary packaging recipe and game commit.

Use a new output directory per build. Git, Node/npm, Rust/Cargo, a C/C++ build toolchain, Linux tar and sha256sum are required. Network access fetches locked npm and Cargo dependencies; native V8 requirements match arena/script-runner. CARGO_TARGET_DIR may reuse a local Cargo build cache.

The command archives the fixed Git commit into output/source, installs locked Node dependencies, builds the production UI and both debug Rust binaries, then collects the existing local runtime layout in output/package. The package contains its own compiler, SDK, MCP dependencies, empty data/log directories and explicit package-local runner paths. output/evidence/BUILD.md records completed build commands; manifest.json records the actual profile and environment. FILES.sha256 covers the payload, followed by a tar.gz and its SHA256 file.

Run package/start.sh with ports 5173 and 8787 available, then open the local UI. Stop with Ctrl-C. Runtime requirements and MCP Chromium setup are in package/README.md. Run centralized acceptance against the generated package and record its results in evidence/. Version tags and GitHub releases follow the version delivery plan.

For the v0.3 candidate recipe, once source assets and scoped runtime reviews are
complete, use a clean committed recipe and a separate fresh output directory:

```sh
node arena/release/build.mjs 0.3.0 SOURCE_COMMIT /absolute/new/v030-output
```

`sourceCommit` is the full game commit resolved from the argument; its archived
source supplies resources, provenance, dependency locks, dist and binaries.
`recipeCommit` is the full clean recipe HEAD providing scripts, launcher and notes.
The v0.3 manifest hashes the actual dist runtime entries and clips listed by each
asset index. `arena/art/asset-provenance-v0.3.0.json` is copied unchanged and hashed;
its scoped source/runtime reviews and pending items do not imply whole-version
approval. See `notes-v0.3.0.md`. Metadata implementation alone does not freeze a
final source, create a package, or authorize a tag/release. The v0.2 command and its
historical approval-record branch remain available unchanged.

The v0.4 graph feature batch uses its own candidate archive and version notes:

```sh
node arena/release/build.mjs 0.4.0 SOURCE_COMMIT /absolute/new/v040-output
```

Wait for complete G1-G4 authoring/MCP integration and the source-freeze instruction
before running this full build. Metadata preparation alone does not start G5 or
approve release. The manifest reuses scoped v0.3 asset provenance while hashing
actual new dist indices/descriptors; its `rules` field additionally hashes and
copies `arena/release/rule-provenance-v0.4.0.json`. Source paths in that record refer
to sourceCommit, not new package runtime services. v0.3/v0.2 metadata branches,
notes, launch paths and per-file checksum layout remain reproducible.
