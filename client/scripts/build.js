// Keep the portable history library shared across the live, Matches and replay
// entry points. CRA's default size threshold duplicates this module otherwise.
process.env.NODE_ENV = "production";
process.env.BABEL_ENV = "production";
const configPath = require.resolve("react-scripts/config/webpack.config");
const createConfig = require(configPath);
require.cache[configPath].exports = (environment) => {
  const config = createConfig(environment);
  // A second safe compression pass keeps the new card UI within the existing
  // bundle budget without relaxing CRA's compatibility safeguards.
  for (const plugin of config.optimization.minimizer) {
    const compress = plugin.options?.minimizer?.options?.compress;
    if (compress && typeof compress === "object") compress.passes = 2;
  }
  config.optimization.splitChunks = {
    ...config.optimization.splitChunks,
    cacheGroups: {
      ...config.optimization.splitChunks?.cacheGroups,
      runtimeHelpers: {
        // Reuse helpers repeated across match/replay chunks to retain the
        // existing JavaScript budget as the full-art card UI is added.
        test: /[\\/]node_modules[\\/]@babel[\\/]runtime[\\/]helpers[\\/]/,
        name: "runtime-helpers",
        chunks: "all",
        minChunks: 2,
        enforce: true,
        priority: 30
      },
      matchHistory: {
        test: /[\\/](?:shared[\\/]match-history[\\/]|src[\\/]match(?:History|Transcript)\.js$)/,
        name: "match-history",
        chunks: "all",
        enforce: true,
        priority: 30
      },
      sharedBabylon: {
        // Keep WebGPU-only shaders separable for the existing WebGL pruning.
        test: /[\\/]node_modules[\\/]@babylonjs[\\/]core[\\/](?!ShadersWGSL[\\/])/,
        name: "babylon-shared",
        chunks: "all",
        minChunks: 2,
        enforce: true,
        priority: 20
      },
      webglShaders: {
        // The card foil uses the standard material's WebGL shaders. Group the
        // small shader modules for shared compression and fewer table requests.
        test: /[\\/]node_modules[\\/]@babylonjs[\\/]core[\\/]Shaders[\\/]/,
        name: "babylon-webgl-shaders",
        chunks: "all",
        enforce: true,
        priority: 25
      }
    }
  };
  return config;
};
require("react-scripts/scripts/build");
