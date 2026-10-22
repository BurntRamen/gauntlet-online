const base = require("./playwright.admin.config");
module.exports = { ...base, testMatch: ["admin-gems.spec.js"], webServer: base.webServer.map((server, index) => index ? server : { ...server, env: { ...server.env, GAUNTLET_GEM_FIXTURE: "true" } }) };
