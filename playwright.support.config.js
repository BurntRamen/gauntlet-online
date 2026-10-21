const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e", testMatch: "paid-support.spec.js", workers: 1, timeout: 90000,
  expect: { timeout: 15000 }, reporter: [["list"], ["html", { outputFolder: "playwright-report/support", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3128", trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } },
  webServer: [
    { command: "node e2e/paid-support-server.js", url: "http://127.0.0.1:4128/api/game-content", reuseExistingServer: false },
    { command: "npm run serve:client-build", url: "http://127.0.0.1:3128", reuseExistingServer: false, timeout: 240000,
      env: { PORT: "3128", REBUILD_CLIENT: "true", REACT_APP_SOCKET_URL: "http://127.0.0.1:4128" } }
  ]
});
