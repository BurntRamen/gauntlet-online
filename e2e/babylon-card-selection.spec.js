const { test, expect } = require("@playwright/test");

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
for (const mode of ["Basic", "Factions"]) {
  test(`${mode} selection stays in place at ${viewport.width}x${viewport.height}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      // Keep graphics scaling constant so the probe isolates selection/layout.
      localStorage.setItem("gauntlet.graphicsQuality", "performance");
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
    const originalBounds = await canvas.boundingBox();
    const originalControls = await page.locator(".production-context-panel").boundingBox();
    await page.evaluate(() => {
      window.tableResizeProbe = { resizes: 0, blankPresentations: 0 };
      window.selectionCanvas = document.querySelector("canvas.babylon-match-canvas");
    });
    for (let index = 0; index < 3; index++) {
      const rail = page.getByTestId("phone-hand-rail");
      if (await rail.isVisible()) {
        await rail.locator("button:not(:disabled)").first().click();
      } else {
        await page.mouse.click(originalBounds.x + originalBounds.width * 0.5, originalBounds.y + originalBounds.height * 0.85);
      }
      const cancel = page.getByRole("region", { name: "Current match action" }).getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeVisible();
      await page.waitForTimeout(100);
      expect(await canvas.boundingBox()).toEqual(originalBounds);
      expect(await page.locator(".production-context-panel").boundingBox()).toEqual(originalControls);
      await expect(page.locator(".production-payment-readout")).toBeVisible();
      if (index === 0) await page.screenshot({ path: test.info().outputPath("selected-card.png") });
      await cancel.click();
      await page.waitForTimeout(100);
      expect(await canvas.boundingBox()).toEqual(originalBounds);
    }
    const result = await page.evaluate(() => window.tableResizeProbe);
    expect(result.resizes).toBe(0);
    expect(result.blankPresentations).toBe(0);
    expect(await canvas.evaluate((element) => element === window.selectionCanvas)).toBe(true);
  });
}
}
