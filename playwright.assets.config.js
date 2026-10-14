const { defineConfig } = require("@playwright/test");
const softwareGraphics = process.env.GAUNTLET_E2E_SOFTWARE_GL === "true" || (process.env.CI === "true" && process.platform === "linux");
const clientPort = process.env.GAUNTLET_ADMIN_CLIENT_PORT || "3117";
module.exports = defineConfig({
  testDir: "./e2e", testMatch: "admin-immutable-assets.spec.js", workers: 1, timeout: 180000,
  use: { baseURL: `http://127.0.0.1:${clientPort}`, channel: "chromium", launchOptions: { args: softwareGraphics ? ["--use-gl=angle", "--use-angle=swiftshader"] : [] }, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run serve:client-build", url: `http://127.0.0.1:${clientPort}`, env: { PORT: clientPort }, reuseExistingServer: false, timeout: 30000 }
});
