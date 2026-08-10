const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const WGSL_SOURCE_SEGMENT = "/ShadersWGSL/";

function normalizedSource(source) {
  return String(source || "").replaceAll("\\", "/");
}

function isPureWebGpuShaderMap(sourceMap) {
  return Array.isArray(sourceMap?.sources)
    && sourceMap.sources.length > 0
    && sourceMap.sources.every((source) => normalizedSource(source).includes(WGSL_SOURCE_SEGMENT));
}

function pruneWebGpuOnlyChunks(buildDirectory) {
  const jsDirectory = path.join(buildDirectory, "static", "js");
  const manifestPath = path.join(buildDirectory, "asset-manifest.json");
  if (!fs.existsSync(jsDirectory)) {
    throw new Error(`Client JavaScript build directory is missing: ${jsDirectory}`);
  }

  const removedFiles = [];
  let removedGzipBytes = 0;
  const sourceMaps = fs.readdirSync(jsDirectory).filter((name) => name.endsWith(".chunk.js.map"));

  for (const mapName of sourceMaps) {
    const mapPath = path.join(jsDirectory, mapName);
    const sourceMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    if (!isPureWebGpuShaderMap(sourceMap)) continue;

    const scriptName = mapName.slice(0, -4);
    const scriptPath = path.join(jsDirectory, scriptName);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`WebGPU-only source map has no matching JavaScript chunk: ${mapName}`);
    }

    const script = fs.readFileSync(scriptPath);
    removedGzipBytes += zlib.gzipSync(script, { level: 9 }).length;
    fs.unlinkSync(scriptPath);
    fs.unlinkSync(mapPath);
    removedFiles.push(`static/js/${scriptName}`, `static/js/${mapName}`);
  }

  if (removedFiles.length > 0 && fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const removedUrls = new Set(removedFiles.map((name) => `/${name}`));
    manifest.files = Object.fromEntries(
      Object.entries(manifest.files || {}).filter(([, url]) => !removedUrls.has(url))
    );
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return {
    removedChunks: removedFiles.filter((name) => name.endsWith(".js")).length,
    removedFiles,
    removedGzipBytes
  };
}

if (require.main === module) {
  const buildDirectory = path.resolve(__dirname, "../client/build");
  const result = pruneWebGpuOnlyChunks(buildDirectory);
  console.log(
    `Pruned ${result.removedChunks} WebGPU-only shader chunks `
    + `(${(result.removedGzipBytes / 1024).toFixed(1)} KiB gzip) from the WebGL production build.`
  );
}

module.exports = {
  isPureWebGpuShaderMap,
  pruneWebGpuOnlyChunks
};
