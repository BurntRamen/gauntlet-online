const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const buildDirectory = path.resolve(__dirname, "../client/build");
const repositoryRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3200);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webp": "image/webp"
};

if (process.env.REBUILD_CLIENT === "true") {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is required to rebuild the client.");
  const build = spawnSync(process.execPath, [npmCli, "run", "build:client"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit"
  });
  if (build.status !== 0) {
    throw new Error(`Client production build failed with exit code ${build.status}.`);
  }
}

if (!fs.existsSync(path.join(buildDirectory, "index.html"))) {
  throw new Error("Client production build is missing. Run npm run build:client first.");
}

function resolveRequestPath(url = "/") {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relativePath = pathname.replace(/^\/+/, "");
  const requested = path.resolve(buildDirectory, relativePath);
  if (!requested.startsWith(`${buildDirectory}${path.sep}`) && requested !== buildDirectory) {
    return null;
  }
  if (relativePath && fs.existsSync(requested) && fs.statSync(requested).isFile()) {
    return requested;
  }
  return path.join(buildDirectory, "index.html");
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  const content = fs.readFileSync(filePath);
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": content.length,
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
  });
  response.end(content);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving the Gauntlet client build at http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
