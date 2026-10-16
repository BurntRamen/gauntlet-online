const base = require("./playwright.admin.config");
module.exports = { ...base, testMatch: ["admin-mechanics.spec.js", "admin-modifiers.spec.js", "admin-encounters.spec.js"], webServer: base.webServer.map((server, index) => index ? server : { ...server, env: { ...server.env, GAUNTLET_PHASE2_FIXTURE: "true" } }) };
