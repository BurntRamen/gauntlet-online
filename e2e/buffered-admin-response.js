"use strict";

async function fetchAdminResponse(route) {
  // route.fetch shares Playwright's Node HTTP pool with other API contexts.
  // Do not lend its idle socket to a later assertion after browser editing.
  const headers = await route.request().allHeaders();
  return route.fetch({ headers: { ...headers, connection: "close" } });
}

function waitForBufferedAdminResponse(page, predicate) {
  const pattern = "**/api/admin/**";
  return new Promise((resolve, reject) => {
    const handler = async (route) => {
      const request = route.request();
      const candidate = { url: () => request.url(), request: () => request };
      if (!predicate(candidate)) {
        await route.continue();
        return;
      }

      try {
        const response = await fetchAdminResponse(route);
        const body = await response.body();
        await route.fulfill({ response, body });
        await page.unroute(pattern, handler);
        const payload = JSON.parse(body.toString("utf8"));
        resolve({
          ok: () => response.ok(),
          status: () => response.status(),
          url: () => response.url(),
          request: () => request,
          json: async () => payload
        });
      } catch (error) {
        await page.unroute(pattern, handler).catch(() => {});
        reject(error);
      }
    };

    page.route(pattern, handler).catch(reject);
  });
}

module.exports = { fetchAdminResponse, waitForBufferedAdminResponse };
