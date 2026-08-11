const base = require("./playwright.config");

module.exports = {
  ...base,
  testMatch: "babylon-live.spec.js",
  reporter: [["list"]]
};
