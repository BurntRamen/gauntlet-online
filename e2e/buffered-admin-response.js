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
        // Playwright's API transport shares a keep-alive pool across contexts.
        // These requests follow long UI operations; do not retain fixture sockets
        // or replay a mutation whose response was lost.
        const response = await route.fetch({ headers: { ...await request.allHeaders(), connection: "close" }, maxRetries: 0 });
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
        // Removing a pending route otherwise releases the original browser
        // request, which could execute the same mutation a second time.
        await route.abort("failed").catch(() => {});
        await page.unroute(pattern, handler).catch(() => {});
        reject(error);
      }
    };

    page.route(pattern, handler).catch(reject);
  });
}

module.exports = { waitForBufferedAdminResponse };
