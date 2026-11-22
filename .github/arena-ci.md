# Arena CI scope

The required `test` job always reports a result. Documentation-only changes run
checkout and the Python selector without installing Rust or Node. Git paths are
NUL-delimited; renames inspect both old and new paths, and deletions count.

| Changed paths | Checks |
| --- | --- |
| Markdown, wiki, arena/docs | Lightweight scope only |
| arena/art | Art pipeline |
| client/public/assets | Art, client build, camera-sample / animation / grip E2E |
| shared/world-map.json | All Rust library tests, client build, isometric E2E |
| Other shared data | Full suite |
| server, script SDK/toolchain/runner | Core, all seven real V8 route tests, HTTP/MCP, browser chain |
| client | Client build and browser / MCP browser |
| tools, tests | Tools unit, HTTP/MCP, MCP browser |
| e2e | Client build and E2E |

Checks are a union: each step runs once, and full E2E supersedes its subsets.
Browser/HTTP scopes prepare the actual authority, compiler and V8 runner without
unrelated unit suites. Workflow/selector changes, integration branches, tags and
manual dispatch run the complete original suite. Unknown Arena code paths and
unavailable/empty comparisons also fall back to full. Budgets, assertions, the
real V8 ignored-tests command and browser evidence retention are unchanged.
