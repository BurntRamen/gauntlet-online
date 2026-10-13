// Keep the portable history library shared across the live, Matches and replay
// entry points. CRA's default size threshold duplicates this module otherwise.
process.env.NODE_ENV = "production";
process.env.BABEL_ENV = "production";
const configPath = require.resolve("react-scripts/config/webpack.config");
const createConfig = require(configPath);
require.cache[configPath].exports = (environment) => {
  const config = createConfig(environment);
  // Keep maps for bundle attribution and manual debugging without downloading
  // their discovery comments in every production chunk.
  if (config.devtool === "source-map") config.devtool = "hidden-source-map";
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
      sharedAuthoringConsumers: {
        // The player shop and Admin use one actual offer renderer; the engine
        // and guided mechanics editor use one validator. Do not duplicate these
        // shared runtime modules in the small private workshop chunks.
        test: /[\\/]src[\\/]DeckOfferCard\.js$|[\\/]shared[\\/]duel-rules[\\/]compositionContract\.js$/,
        name: "content-consumers",
        chunks: "async",
        minChunks: 2,
        enforce: true,
        priority: 40
      },
      matchRuntime: {
        // The live adapter and table already load together. Compress them with
        // their shared rules instead of paying for separate small chunks.
        // Replay and ability-preview entry points retain their own lazy loads.
        test: /[\\/]src[\\/]babylon[\\/](?!(?:MatchReplayScreen|ReplayMatchAdapter|ReplayTranscript|AbilityPreview)\.)|[\\/]shared[\\/](?:basic-gauntlet-rules|duel-rules)[\\/]/,
        name: "gauntlet-match",
        chunks: "async",
        enforce: true,
        priority: 15
      },
      adminShared: {
        // Workshop panels share these small modules; count the named split in
        // the aggregate Admin budget rather than duplicating it in each panel.
        test: /[\\/]src[\\/](?:admin[\\/](?:WorkshopShell|RelatedContent)|GauntletContractFields)\.js$/,
        name: "gauntlet-admin-shared",
        chunks: "async",
        minChunks: 2,
        enforce: true,
        priority: 35
      },
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
