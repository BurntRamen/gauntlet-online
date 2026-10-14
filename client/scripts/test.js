process.env.NODE_ENV = "test";
process.env.BABEL_ENV = "test";
require("../config/environment").loadEnvironment(require("node:path").resolve(__dirname, ".."), "test");
require("jest").run(process.argv.slice(2));
