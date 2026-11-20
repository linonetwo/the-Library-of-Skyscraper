// Development-only proxy: source changes restart TiddlyWiki and notify open tabs.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const wiki = path.resolve(__dirname, "../../wiki");
const clients = new Set();
const uiState =
  /^(?:\$:\/(?:StoryList|HistoryList|state\/|temp\/)|\$__?(?:StoryList|HistoryList|state_|temp_))/;
let child,
  ready = false,
  timer,
  restarting = false,
  pending = false,
  stopping = false;
let revision = 0;
const script = `<script>(()=>{let rev;const e=new EventSource('/__wiki_events');e.onmessage=m=>{const n=JSON.parse(m.data);if(rev!==undefined&&rev!==n){try{sessionStorage.setItem('wiki-open-story',JSON.stringify($tw.wiki.getTiddlerList('$:/StoryList')))}catch(_){}location.reload()}rev=n};const t=setInterval(()=>{if(window.$tw&&$tw.boot&&$tw.rootWidget&&$tw.wiki){clearInterval(t);const s=sessionStorage.getItem('wiki-open-story');if(s){sessionStorage.removeItem('wiki-open-story');$tw.wiki.addTiddler({title:'$:/StoryList',list:JSON.parse(s)})}}},100)})()</script>`;
function announce() {
  for (const res of clients) res.write(`data: ${JSON.stringify(revision)}\n\n`);
}
function waitReady(proc) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    function poll() {
      if (proc.exitCode !== null || stopping)
        return reject(Error("TiddlyWiki stopped"));
      const req = http.get("http://127.0.0.1:3001/status", (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(1000, () => req.destroy());
    }
    function retry() {
      if (Date.now() - started > 120000)
        reject(Error("TiddlyWiki startup timed out"));
      else setTimeout(poll, 250);
    }
    poll();
  });
}
async function restart() {
  if (stopping) return;
  if (restarting) {
    pending = true;
    return;
  }
  restarting = true;
  ready = false;
  try {
    if (child && child.exitCode === null) {
      const old = child;
      await new Promise((resolve) => {
        old.once("exit", resolve);
        old.kill("SIGTERM");
      });
    }
    child = spawn(
      process.execPath,
      [
        path.join(__dirname, "node_modules/tiddlywiki/tiddlywiki.js"),
        "+plugins/tiddlywiki/filesystem",
        "+plugins/tiddlywiki/tiddlyweb",
        wiki,
        "--listen",
        "host=127.0.0.1",
        "port=3001",
      ],
      { stdio: "inherit" },
    );
    console.log("TiddlyWiki PID", child.pid, "internal 127.0.0.1:3001");
    await waitReady(child);
    ready = true;
    revision++;
    announce();
    console.log("Wiki ready; revision", revision);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    restarting = false;
    if (pending) {
      pending = false;
      schedule();
    }
  }
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(restart, 600);
}
const watcher = fs.watch(wiki, { recursive: true }, (event, filename) => {
  if (!filename) return;
  const relative = String(filename);
  if (relative.split(path.sep).some((p) => p.startsWith(".") || p === "output"))
    return;
  const base = path.basename(relative).replace(/\.tid$/, "");
  if (uiState.test(base)) return;
  try {
    const fd = fs.openSync(path.join(wiki, relative), "r");
    const buffer = Buffer.alloc(2048);
    const size = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);
    const title = buffer.toString("utf8", 0, size).match(/^title: (.+)$/m);
    if (title && uiState.test(title[1])) return;
  } catch (_) {}
  console.log("Wiki source changed:", relative);
  schedule();
});
const server = http.createServer((req, res) => {
  if (req.url === "/__wiki_events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");
    clients.add(res);
    if (ready) res.write(`data: ${JSON.stringify(revision)}\n\n`);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (!ready) {
    res.writeHead(503, { "Retry-After": "2" });
    res.end("Wiki is restarting; retry shortly.");
    return;
  }
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 3001,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, "accept-encoding": "identity" },
    },
    (response) => {
      const html = /text\/html/.test(response.headers["content-type"] || "");
      const headers = { ...response.headers };
      if (html) {
        delete headers["content-length"];
        delete headers.etag;
        res.writeHead(response.statusCode, headers);
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          res.end(
            Buffer.concat(chunks)
              .toString()
              .replace("</body>", script + "</body>"),
          ),
        );
      } else {
        res.writeHead(response.statusCode, headers);
        response.pipe(res);
      }
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("Wiki unavailable");
  });
  req.pipe(upstream);
});
const heartbeat = setInterval(() => {
  for (const res of clients) res.write(": heartbeat\n\n");
}, 15000);
function stop() {
  stopping = true;
  watcher.close();
  clearTimeout(timer);
  clearInterval(heartbeat);
  for (const res of clients) res.end();
  server.close();
  if (child) child.kill("SIGTERM");
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
server.listen(3000, "0.0.0.0", () =>
  console.log("Wiki proxy listening on 0.0.0.0:3000"),
);
restart();
