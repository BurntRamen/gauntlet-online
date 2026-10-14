const path = require("node:path");
module.exports = { process(source, filename) { return { code: `module.exports = ${filename.endsWith(".css") ? "{}" : JSON.stringify(path.basename(filename))};` }; } };
