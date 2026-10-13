module.exports = { ...require("./playwright.assets.config"), testMatch: "admin-decks.spec.js", timeout: 240000, use: { ...require("./playwright.assets.config").use, actionTimeout: 20000 } };
