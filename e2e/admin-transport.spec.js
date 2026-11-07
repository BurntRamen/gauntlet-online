"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { test, expect } = require("@playwright/test");
const { waitForBufferedAdminResponse } = require("./buffered-admin-response");

test("buffered Admin responses preserve the request without lending their socket to another API context", async ({ page, playwright }) => {
  const sockets = new Set(), writes = [];
  let sequence = 0, probes = 0;
  const server = http.createServer(async (incoming, response) => {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    if (incoming.url === "/api/admin/authoring/record") {
      const write = { socket: incoming.socket.id, method: incoming.method, headers: incoming.headers, body: Buffer.concat(chunks).toString("utf8") };
      writes.push(write);
      response.writeHead(201, { "Content-Type": "application/json", "X-Record-Revision": "8" });
      response.end(JSON.stringify({ revision: 8, socket: write.socket }));
    } else if (incoming.url === "/probe") {
      probes += 1;
      // Model the server retiring a pooled connection. A fresh API context
      // must not inherit the intercepted browser request's Node HTTP socket.
      if (writes.some(write => write.socket === incoming.socket.id)) return incoming.socket.resetAndDestroy();
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ socket: incoming.socket.id }));
    } else {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<!doctype html><title>Isolated transport regression</title>");
    }
  });
  server.keepAliveTimeout = 60000;
  server.on("connection", socket => {
    socket.id = ++sequence;
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let api;
  try {
    await page.context().addCookies([{ name: "fixture_session", value: "transport-only", url: origin }]);
    await page.goto(origin);
    api = await playwright.request.newContext({ extraHTTPHeaders: { Connection: "close" } });
    const payload = JSON.stringify({ expectedRevision: 7, name: "Retained — exact bytes" });
    const buffered = waitForBufferedAdminResponse(page, candidate => candidate.url().endsWith("/authoring/record"));
    const rendered = page.evaluate(async body => {
      const response = await fetch("/api/admin/authoring/record", {
        method: "POST", headers: { Authorization: "Bearer fixture-only", "Content-Type": "application/json", "X-Request-Evidence": "preserved" }, body
      });
      return { status: response.status, revision: response.headers.get("X-Record-Revision"), body: await response.json() };
    }, payload);
    const [captured, browserResponse] = await Promise.all([buffered, rendered]);
    assert.equal(captured.status(), 201);
    assert.equal(captured.ok(), true);
    assert.deepEqual(await captured.json(), browserResponse.body);
    assert.equal(browserResponse.status, 201);
    assert.equal(browserResponse.revision, "8");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "POST");
    assert.equal(writes[0].body, payload);
    assert.equal(writes[0].headers.authorization, "Bearer fixture-only");
    assert.equal(writes[0].headers.cookie, "fixture_session=transport-only");
    assert.equal(writes[0].headers["content-type"], "application/json");
    assert.equal(writes[0].headers["x-request-evidence"], "preserved");
    const probe = await api.get(origin + "/probe");
    assert.equal(probe.status(), 200);
    assert.notEqual((await probe.json()).socket, writes[0].socket);
    assert.equal(probes, 1, "The read must succeed without retrying a reset connection.");
    assert.equal(writes.length, 1, "The intercepted mutation must be sent exactly once.");
  } finally {
    await api?.dispose();
    await new Promise(resolve => {
      server.close(resolve);
      for (const socket of sockets) socket.destroy();
    });
  }
});

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
