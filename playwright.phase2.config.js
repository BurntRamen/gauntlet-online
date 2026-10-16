const base = require("./playwright.admin.config");
module.exports = { ...base, testMatch: ["admin-mechanics.spec.js", "admin-modifiers.spec.js"] };
