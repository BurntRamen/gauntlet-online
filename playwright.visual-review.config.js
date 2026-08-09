const base = require("./playwright.config");

module.exports = {
  ...base,
  testMatch: "babylon-visual-review.spec.js",
  reporter: [["list"]]
};
