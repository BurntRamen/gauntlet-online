const { test: base, expect } = require("@playwright/test");

// API assertions are separated by long UI interactions and server restarts.
// Avoid reusing a Node HTTP socket that the fixture has already closed during
// that interval. Browser HTTP and WebSocket behavior stays unchanged.
const test = base.extend({
  request: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Connection: "close" } });
    try { await use(request); } finally { await request.dispose(); }
  }
});

module.exports = { test, expect };
