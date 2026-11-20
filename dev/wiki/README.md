# Local Wiki server

Run `npm ci` once, then `npm start` in this directory. The server listens on port 3000 and uses the repository's `wiki` directory. TiddlyWiki's filesystem and tiddlyweb plugins provide file watching and browser synchronization; clients poll for changes, so updates are not instantaneous.
