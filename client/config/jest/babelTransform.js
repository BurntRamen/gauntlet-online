module.exports = require("babel-jest").createTransformer({
  babelrc: false, configFile: false,
  presets: [[require.resolve("@babel/preset-env"), { targets: { node: "current" } }], [require.resolve("@babel/preset-react"), { runtime: "automatic", development: true }]]
});
