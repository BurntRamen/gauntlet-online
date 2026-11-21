// Preserve the existing player/Admin boundaries and source-map budget attribution.
module.exports = {
  chunks: "async",
  cacheGroups: {
    // Player menus are also the Website Studio renderer. Keep their shared
    // implementation with the existing lazy player entry, avoiding a second
    // request and compression boundary. Admin controls retain their own chunk.
    playerPresentation: { test: /[\\/]src[\\/]navigation[\\/](?:PlayerMenus|PlayerShell|PlayerLayoutStudio|PlayerMenuExperience|WebsitePresentation|PlayerPageHeader|ActionTile|destinations|layoutPreferences|layoutRegistry)\.(?:js|jsx)$/, name: "gauntlet-command-deck", chunks: "async", enforce: true, priority: 35 },
    sharedAuthoringConsumers: { test: /[\\/]src[\\/]DeckOfferCard\.js$|[\\/]shared[\\/]duel-rules[\\/]compositionContract\.js$/, name: "content-consumers", chunks: "async", minChunks: 2, enforce: true, priority: 40 },
    matchRuntime: { test: /[\\/]src[\\/]babylon[\\/](?!(?:MatchReplayScreen|ReplayMatchAdapter|ReplayTranscript|AbilityPreview)\.)|[\\/]shared[\\/](?:basic-gauntlet-rules|duel-rules)[\\/]/, name: "gauntlet-match", chunks: "async", enforce: true, priority: 15 },
    adminShared: { test: /[\\/]src[\\/](?:admin[\\/](?:WorkshopShell|RelatedContent|WorkshopNavigation|ReleaseReview)|GauntletContractFields)\.js$/, name: "gauntlet-admin-workshops", chunks: "async", minChunks: 1, enforce: true, priority: 35 },
    runtimeHelpers: { test: /[\\/]node_modules[\\/]@babel[\\/]runtime[\\/]helpers[\\/]/, name: "runtime-helpers", chunks: "all", minChunks: 2, enforce: true, priority: 30 },
    matchHistory: { test: /[\\/](?:shared[\\/]match-history[\\/]|src[\\/]match(?:History|Transcript)\.js$)/, name: "match-history", chunks: "all", enforce: true, priority: 30 },
    sharedBabylon: { test: /[\\/]node_modules[\\/]@babylonjs[\\/]core[\\/](?!ShadersWGSL[\\/])/, name: "babylon-shared", chunks: "all", minChunks: 2, enforce: true, priority: 20 },
    webglShaders: { test: /[\\/]node_modules[\\/]@babylonjs[\\/]core[\\/]Shaders[\\/]/, name: "babylon-webgl-shaders", chunks: "all", enforce: true, priority: 25 }
  }
};
