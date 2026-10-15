const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".map": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".woff2": "font/woff2" };

function createServer(directory) {
  const base = fs.realpathSync(directory);
  return http.createServer((req, res) => {
    const hosts = [`localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}`];
    const finish = (status, text) => { res.writeHead(status, { "Content-Type": "text/plain", "Cache-Control": "no-store" }); res.end(text); };
    if (!hosts.includes(req.headers.host) || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) || req.headers["sec-fetch-site"] === "cross-site") return finish(403, "Forbidden");
    if (!["GET", "HEAD"].includes(req.method)) return finish(405, "Method not allowed");
    let pathname;
    try { pathname = decodeURIComponent(req.url.split("?")[0]); } catch { return finish(400, "Invalid path"); }
    if (!pathname.startsWith("/") || /[\\\0:]/.test(pathname) || pathname.split("/").some(part => part === ".." || part.startsWith("."))) return finish(403, "Forbidden");
    let file = path.resolve(base, `.${pathname}`);
    if (!file.startsWith(`${base}${path.sep}`) && file !== base) return finish(403, "Forbidden");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (path.extname(pathname)) return finish(404, "Not found");
      file = path.join(base, "index.html");
    }
    if (!fs.existsSync(file)) return finish(503, "Compiling; refresh shortly.");
    const real = fs.realpathSync(file);
    if (!real.startsWith(`${base}${path.sep}`)) return finish(403, "Forbidden");
    res.writeHead(200, { "Content-Type": mime[path.extname(real)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(real).on("error", () => res.destroy()).pipe(res);
  });
}

function start() {
  process.env.NODE_ENV = "development";
  process.env.BABEL_ENV = "development";
  require("../config/environment").loadEnvironment(root, "development");
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid development port");
  require("./build").prepareOutput();
  const compiler = require("webpack")(require("../config/webpack.config")("development"));
  const watcher = compiler.watch({}, (error, stats) => {
    if (error) console.error(error);
    else console.log(stats.toString({ colors: false, preset: "errors-warnings" }));
    console.log("Refresh the browser after a successful compilation.");
  });
  const server = createServer(path.join(root, "build"));
  server.listen(port, "127.0.0.1", () => console.log(`Gauntlet development: http://127.0.0.1:${port}`));
  const stop = () => { server.closeAllConnections(); server.close(); watcher.close(() => compiler.close(() => { process.exitCode = 0; })); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
if (require.main === module) start();
module.exports = { createServer, start };
