const base = require("./playwright.admin-redesign.config");
module.exports = { ...base, timeout: 120000, testMatch: ["admin-studio.spec.js", "admin-redesign.spec.js", "admin-refinement.spec.js", "admin-pipelines.spec.js"], reporter: [["list"], ["json", { outputFile: "artifacts/admin-studio-results.json" }]] };
