// Keep the portable history library shared across the live, Matches and replay
// entry points. CRA's default size threshold duplicates this module otherwise.
process.env.NODE_ENV = "production";
process.env.BABEL_ENV = "production";
const configPath = require.resolve("react-scripts/config/webpack.config");
const createConfig = require(configPath);
require.cache[configPath].exports = (environment) => {
  const config = createConfig(environment);
  config.optimization.splitChunks = {
    ...config.optimization.splitChunks,
    cacheGroups: {
      ...config.optimization.splitChunks?.cacheGroups,
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
      }
    }
  };
  return config;
};
require("react-scripts/scripts/build");
