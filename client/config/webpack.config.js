const fs = require("node:fs");
const path = require("node:path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { publicEnvironment } = require("./environment");
const root = path.resolve(__dirname, "..");

class AssetManifestPlugin {
  constructor(publicPath) { this.publicPath = publicPath; }
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("AssetManifest", compilation => {
      compilation.hooks.processAssets.tap({ name: "AssetManifest", stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        const files = Object.fromEntries(compilation.getAssets().map(({ name }) => [name, this.publicPath + name]));
        const entrypoints = [...compilation.entrypoints.get("main").getFiles()].filter(name => !name.endsWith(".map"));
        compilation.emitAsset("asset-manifest.json", new webpack.sources.RawSource(JSON.stringify({ files, entrypoints }, null, 2)));
      });
    });
  }
}

module.exports = function createConfig(mode = "production", environment = process.env) {
  const production = mode === "production";
  const exposed = publicEnvironment(mode, environment);
  const publicPath = `${exposed.PUBLIC_URL}/`;
  const babel = react => ({
    loader: require.resolve("babel-loader"),
    options: {
      babelrc: false, configFile: false, cacheDirectory: true,
      presets: [[require.resolve("@babel/preset-env"), { exclude: ["transform-typeof-symbol"] }], ...(react ? [[require.resolve("@babel/preset-react"), { runtime: "automatic", development: !production }]] : [])],
      plugins: [[require.resolve("@babel/plugin-transform-runtime"), { absoluteRuntime: path.dirname(require.resolve("@babel/runtime/package.json")), version: require("@babel/runtime/package.json").version }]]
    }
  });
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8").replace(/%([A-Z0-9_]+)%/g, (match, key) => Object.hasOwn(exposed, key) ? String(exposed[key]).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]) : match);
  return {
    context: root, mode, target: "browserslist", bail: production,
    entry: path.join(root, "src/index.js"),
    devtool: production ? "hidden-source-map" : "source-map",
    output: {
      path: path.join(root, "build"), publicPath, filename: "static/js/[name].[contenthash:8].js", chunkFilename: "static/js/[name].[contenthash:8].chunk.js",
      assetModuleFilename: "static/media/[name].[hash:8][ext]", module: false, iife: true, chunkFormat: "array-push", chunkLoading: "jsonp"
    },
    cache: { type: "filesystem", buildDependencies: { config: [__filename, require.resolve("./splitChunks"), require.resolve("./environment")] } },
    resolve: { extensions: [".web.js", ".js", ".jsx", ".mjs", ".json"], modules: ["node_modules", path.join(root, "node_modules")] },
    module: { rules: [{ oneOf: [
      { test: /\.(js|jsx|mjs)$/, include: path.join(root, "src"), ...babel(true) },
      { test: /\.(js|mjs)$/, exclude: /[\\/]@babel[\\/]runtime[\\/]/, ...babel(false) },
      { test: /\.css$/, sideEffects: true, use: [MiniCssExtractPlugin.loader, { loader: require.resolve("css-loader"), options: { importLoaders: 1, sourceMap: true, modules: { mode: "icss" } } }, { loader: require.resolve("postcss-loader"), options: { sourceMap: true, postcssOptions: { config: false, plugins: [[require.resolve("postcss-preset-env"), { stage: 3, autoprefixer: { flexbox: "no-2009" } }]] } } }] },
      { test: /\.(bmp|gif|jpe?g|png)$/, type: "asset", parser: { dataUrlCondition: { maxSize: 10000 } } },
      { exclude: [/\.(js|jsx|mjs|cjs)$/, /\.html$/, /\.json$/], type: "asset/resource" }
    ] }] },
    optimization: {
      minimize: production,
      minimizer: [new TerserPlugin({ terserOptions: { parse: { ecma: 8 }, compress: { ecma: 5, comparisons: false, inline: 2, passes: 2 }, mangle: { safari10: true }, format: { ecma: 5, comments: false, ascii_only: true } } }), new CssMinimizerPlugin()],
      splitChunks: require("./splitChunks")
    },
    plugins: [new webpack.DefinePlugin({ "process.env": Object.fromEntries(Object.entries(exposed).map(([key, value]) => [key, JSON.stringify(value)])) }), new HtmlWebpackPlugin({ templateContent: html, inject: "body", scriptLoading: "defer", minify: production }), new MiniCssExtractPlugin({ filename: "static/css/[name].[contenthash:8].css", chunkFilename: "static/css/[name].[contenthash:8].chunk.css" }), new AssetManifestPlugin(publicPath)],
    performance: false, stats: "errors-warnings"
  };
};
