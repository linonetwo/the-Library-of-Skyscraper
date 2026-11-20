# Local Wiki server

Use Node 22 or later. Run `npm ci` once, then `npm start` in this directory.
Open http://localhost:3000 (forward only port 3000 in a remote workspace).

`server.cjs` runs TiddlyWiki on **127.0.0.1:3001** and a development HTTP
proxy on **0.0.0.0:3000**. Native `fs.watch` watches the repository's `wiki`
directory recursively. After a 600 ms debounce, source changes restart the
internal server; once `/status` succeeds, an SSE message tells existing browser
tabs to reload. The proxy injects the small reload script into HTML responses.
This is a full reload after a server restart, so large wikis take a few seconds.
Open story titles are retained in session storage across automatic reloads.
Unsaved editor drafts should be saved before editing source files externally.

StoryList, HistoryList, `$:/state/`, and `$:/temp/` changes are excluded so
browser navigation and transient UI writes do not cause restart loops. Hidden
files and the `output` directory are ignored. Content edits made in the browser
also trigger a reload after TiddlyWiki writes them to disk. Filesystem and
tiddlyweb plugins provide persistence and HTTP sync; they do **not** watch and
reload externally edited source files themselves.

This is a local development service with unauthenticated Wiki write access;
use it on a trusted workspace connection. Stop `npm start` with Ctrl-C to stop
both processes. No bundler or framework is involved.
