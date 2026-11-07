"use strict";

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
        // Long UI steps can outlive the fixture's keep-alive timeout. Use a
        // fresh transport for intercepted writes; never retry a mutation whose
        // response was lost, because it may already have committed.
        const response = await route.fetch({ headers: { ...request.headers(), connection: "close" } });
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
        await route.abort("failed").catch(() => {});
        await page.unroute(pattern, handler).catch(() => {});
        reject(error);
      }
    };

    page.route(pattern, handler).catch(reject);
  });
}

module.exports = { waitForBufferedAdminResponse };
