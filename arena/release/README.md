# Rebuild a local candidate

From a checkout containing this command, run:

```sh
node arena/release/build.mjs 0.1.0 59403162b5638c9a843af35613b78e770bdb408c /absolute/new/output
```

Use a new output directory per build. Git, Node/npm, Rust/Cargo, a C/C++ build toolchain, Linux tar and sha256sum are required. Network access fetches locked npm and Cargo dependencies; native V8 requirements match arena/script-runner. CARGO_TARGET_DIR may reuse a local Cargo build cache.

The command archives the fixed Git commit into output/source, installs locked Node dependencies, builds the production UI and both debug Rust binaries, then collects the existing local runtime layout in output/package. The package contains its own compiler, SDK, MCP dependencies, empty data/log directories and explicit package-local runner paths. output/evidence/BUILD.md records completed build commands; manifest.json records the actual profile and environment. FILES.sha256 covers the payload, followed by a tar.gz and its SHA256 file.

Run package/start.sh with ports 5173 and 8787 available, then open the local UI. Stop with Ctrl-C. Runtime requirements and MCP Chromium setup are in package/README.md. Run centralized acceptance against the generated package and record its results in evidence/. Version tags and GitHub releases follow the version delivery plan.
