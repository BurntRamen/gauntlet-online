const { test, expect } = require("@playwright/test");

for (const mode of ["Basic", "Factions"]) {
  test(`${mode} card selection repaints a resized table before the browser presents it`, async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      const dirty = new Set();
      window.tableResizeProbe = { resizes: 0, blankPresentations: 0 };
      for (const property of ["width", "height"]) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, property);
        Object.defineProperty(HTMLCanvasElement.prototype, property, {
          ...descriptor,
          set(value) {
            descriptor.set.call(this, value);
            if (this.matches(".babylon-match-canvas")) {
              dirty.add(this);
              window.tableResizeProbe.resizes++;
            }
          }
        });
      }
      for (const context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!context) continue;
        for (const method of ["drawElements", "drawArrays"]) {
          const original = context.prototype[method];
          context.prototype[method] = function (...args) {
            const result = original.apply(this, args);
            dirty.delete(this.canvas);
            return result;
          };
        }
      }
      const NativeResizeObserver = window.ResizeObserver;
      window.ResizeObserver = class extends NativeResizeObserver {
        constructor(callback) {
          super((entries, observer) => {
            callback(entries, observer);
            if (entries.some(({ target }) => target.matches(".babylon-match-canvas")) && dirty.size) {
              window.tableResizeProbe.blankPresentations++;
            }
          });
        }
      };
    });
    await page.goto(baseURL);
    await page.locator('button[data-area="play"]').click();
    await page.getByRole("button", { name: new RegExp(`${mode} vs AI`) }).click();
    if (mode === "Factions") {
      await page.getByRole("button", { name: "Choose Rumin" }).click();
      await page.getByRole("button", { name: "Confirm Start" }).click();
    }
    await expect(page.getByTestId("production-babylon-match")).toBeVisible();
    const canvas = page.locator("canvas.babylon-match-canvas");
    await expect(page.locator('[data-match-zone="hand"]:not(:disabled)').first()).toBeAttached();
    await page.waitForTimeout(1000);
    await page.evaluate(() => { window.tableResizeProbe = { resizes: 0, blankPresentations: 0 }; });
    for (let index = 0; index < 3; index++) {
      const bounds = await canvas.boundingBox();
      await page.mouse.click(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.85);
      const cancel = page.getByRole("region", { name: "Current match action" }).getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeVisible();
      await page.waitForTimeout(100);
      await cancel.click();
      await page.waitForTimeout(100);
    }
    const result = await page.evaluate(() => window.tableResizeProbe);
    expect(result.resizes).toBeGreaterThan(0);
    expect(result.blankPresentations).toBe(0);
  });
}
