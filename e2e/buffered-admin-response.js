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
        const response = await route.fetch();
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

module.exports = { waitForBufferedAdminResponse };
