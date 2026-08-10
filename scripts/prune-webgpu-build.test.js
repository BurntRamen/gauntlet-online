const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  isPureWebGpuShaderMap,
  pruneWebGpuOnlyChunks
} = require("./prune-webgpu-build");

function writeChunk(jsDirectory, name, sources) {
  fs.writeFileSync(path.join(jsDirectory, name), `self.webpackChunkgauntlet_online.push([[1],{}]);\n`);
  fs.writeFileSync(path.join(jsDirectory, `${name}.map`), JSON.stringify({ version: 3, sources }));
}

test("identifies only source maps made entirely from Babylon WGSL shaders", () => {
  assert.equal(isPureWebGpuShaderMap({ sources: ["../dev/core/src/ShadersWGSL/default.vertex.ts"] }), true);
  assert.equal(isPureWebGpuShaderMap({ sources: ["../dev/core/src/Shaders/default.vertex.ts"] }), false);
  assert.equal(isPureWebGpuShaderMap({
    sources: [
      "../dev/core/src/ShadersWGSL/default.vertex.ts",
      "babylon/createGauntletScene.js"
    ]
  }), false);
});

test("prunes pure WGSL chunks while preserving WebGL and mixed chunks", (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-webgpu-prune-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const jsDirectory = path.join(temporaryRoot, "static", "js");
  fs.mkdirSync(jsDirectory, { recursive: true });

  writeChunk(jsDirectory, "101.wgsl.chunk.js", ["../dev/core/src/ShadersWGSL/default.fragment.ts"]);
  writeChunk(jsDirectory, "102.webgl.chunk.js", ["../dev/core/src/Shaders/default.fragment.ts"]);
  writeChunk(jsDirectory, "103.mixed.chunk.js", [
    "../dev/core/src/ShadersWGSL/default.vertex.ts",
    "babylon/createGauntletScene.js"
  ]);
  fs.writeFileSync(path.join(temporaryRoot, "asset-manifest.json"), JSON.stringify({
    files: {
      wgsl: "/static/js/101.wgsl.chunk.js",
      wgslMap: "/static/js/101.wgsl.chunk.js.map",
      webgl: "/static/js/102.webgl.chunk.js",
      mixed: "/static/js/103.mixed.chunk.js"
    }
  }));

  const result = pruneWebGpuOnlyChunks(temporaryRoot);
  const manifest = JSON.parse(fs.readFileSync(path.join(temporaryRoot, "asset-manifest.json"), "utf8"));

  assert.equal(result.removedChunks, 1);
  assert.equal(fs.existsSync(path.join(jsDirectory, "101.wgsl.chunk.js")), false);
  assert.equal(fs.existsSync(path.join(jsDirectory, "101.wgsl.chunk.js.map")), false);
  assert.equal(fs.existsSync(path.join(jsDirectory, "102.webgl.chunk.js")), true);
  assert.equal(fs.existsSync(path.join(jsDirectory, "103.mixed.chunk.js")), true);
  assert.deepEqual(manifest.files, {
    webgl: "/static/js/102.webgl.chunk.js",
    mixed: "/static/js/103.mixed.chunk.js"
  });
});
