const { test, expect } = require("@playwright/test");
const http = require("node:http");
const { waitForBufferedAdminResponse } = require("./buffered-admin-response");

// A real HTTP server verifies socket behavior as well as response buffering.
const transportTest = test.extend({
  transport: async ({}, use) => {
    const calls = [];
    let nextConnection = 0;
    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith("/api/admin/")) { res.end("Admin transport fixture"); return; }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const call = { connection: req.socket.fixtureId, method: req.method,
        body: Buffer.concat(chunks).toString(), authorization: req.headers.authorization };
      calls.push(call);
      if (req.url.endsWith("/reset")) { req.socket.destroy(); return; }
      res.writeHead(req.url.endsWith("/error") ? 503 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(call));
    });
    server.on("connection", socket => { socket.fixtureId = ++nextConnection; });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try { await use({ url: `http://127.0.0.1:${server.address().port}`, calls }); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

async function send(page, endpoint) {
  return page.evaluate(async endpoint => {
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "fixture-only" }, body: JSON.stringify({ value: 42 }) });
      return { status: response.status, body: await response.json() };
    } catch { return { failed: true }; }
  }, endpoint);
}

transportTest("buffered Admin mutations use separate connections and preserve request and response content", async ({ page, transport }) => {
  await page.goto(transport.url);
  const responses = [];
  for (let index = 0; index < 2; index++) {
    const pending = waitForBufferedAdminResponse(page, r => r.url().endsWith("/api/admin/save"));
    const browser = send(page, "/api/admin/save");
    const response = await pending;
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(await browser).toEqual({ status: 200, body });
    expect(body).toMatchObject({ method: "PATCH", body: '{"value":42}', authorization: "fixture-only" });
    responses.push(body);
  }
  expect(transport.calls).toHaveLength(2);
  expect(responses[0].connection).not.toBe(responses[1].connection);
});

transportTest("buffered Admin failures are surfaced without replaying a mutation", async ({ page, transport }) => {
  await page.goto(transport.url);
  const reset = waitForBufferedAdminResponse(page, r => r.url().endsWith("/api/admin/reset"));
  const rejected = expect(reset).rejects.toThrow(/ECONNRESET|socket hang up/);
  const browserReset = send(page, "/api/admin/reset");
  await rejected;
  expect(await browserReset).toEqual({ failed: true });
  expect(transport.calls).toHaveLength(1);
  const pending = waitForBufferedAdminResponse(page, r => r.url().endsWith("/api/admin/error"));
  const browserError = send(page, "/api/admin/error");
  const response = await pending;
  expect(response.ok()).toBe(false);
  expect(response.status()).toBe(503);
  expect((await browserError).status).toBe(503);
  expect(transport.calls).toHaveLength(2);
});
