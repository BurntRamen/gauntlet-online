const base = require("./playwright.admin.config");
module.exports = { ...base, testMatch: "admin-production.spec.js", webServer: base.webServer.map((server, index) => index ? server : { ...server, env: { ...server.env, GAUNTLET_PRODUCTION_FIXTURE: "true" } }) };
