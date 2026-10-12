const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const viewports = [
  [1366, 768], [1920, 1080], [2560, 1440], [3440, 1440],
  [1180, 820], [390, 844], [844, 390]
];
const root = path.resolve(__dirname, "../artifacts/desktop-match-polish");

async function enterPractice(page, baseURL) {
  await page.goto(baseURL);
  await page.locator('button[data-area="play"]').click();
  await page.getByRole("button", { name: /Basic vs AI/ }).click();
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
}

async function settle(page) {
  const match = page.getByTestId("production-babylon-match");
  await expect(match).toHaveAttribute("data-playback-catching-up", "false");
  await expect(match).toHaveAttribute("data-active-transition-count", "0");
  await page.waitForTimeout(250);
}

async function metrics(page) {
  return page.locator("canvas.babylon-match-canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const match = document.querySelector('[data-testid="production-babylon-match"]');
    const instruction = document.querySelector(".production-context-copy > strong");
    return {
      browser: navigator.userAgent, dpr: devicePixelRatio,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
      viewport: [innerWidth, innerHeight], css: [canvas.clientWidth, canvas.clientHeight],
      buffer: [canvas.width, canvas.height], graphics: match.dataset.graphicsQuality,
      scaling: match.dataset.hardwareScalingLevel, instructionFont: getComputedStyle(instruction).fontSize,
      matchId: match.dataset.matchId, revision: match.dataset.revision,
      scene: canvas.__gauntletCaptureControl?.snapshot?.() || {
        fps: Number(match.dataset.renderFps), drawCalls: Number(match.dataset.drawCalls),
        meshes: Number(match.dataset.sceneMeshCount), activeCards: Number(match.dataset.cardActorCount)
      }
    };
  });
}

test("desktop inspection, payment and focus keep the battlefield and primary controls fixed", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  await enterPractice(page, baseURL);
  for (const [width, height] of viewports.slice(0, 5)) {
    await page.setViewportSize({ width, height });
    await settle(page);
    const canvas = page.locator("canvas.babylon-match-canvas");
    const action = page.getByRole("region", { name: "Current match action" });
    const canvasBounds = await canvas.boundingBox(), actionBounds = await action.boundingBox();
    const revision = await page.getByTestId("production-babylon-match").getAttribute("data-revision");
    expect(canvasBounds.x + canvasBounds.width).toBeLessThan(actionBounds.x);
    expect(canvasBounds.width / canvasBounds.height).toBeGreaterThan(1.7);
    expect(parseFloat(await action.locator(".production-context-copy > strong").evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
    for (const plate of await page.locator(".production-player-plate").all()) {
      const box = await plate.boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(canvasBounds.y);
    }
    await page.getByRole("button", { name: /^Inspect hand ·/ }).click();
    const handDialog = page.getByRole("dialog", { name: "Inspect your hand" });
    await handDialog.locator(".production-inspect-hand button").first().click();
    const inspect = page.locator(".production-card-inspection");
    await expect(inspect).toBeVisible();
    expect(await inspect.getAttribute("aria-modal")).toBeNull();
    const bounds = await inspect.boundingBox();
    expect(bounds.x).toBeGreaterThan(canvasBounds.x + canvasBounds.width);
    expect(bounds.y + bounds.height).toBeLessThan(actionBounds.y);
    await inspect.getByRole("button", { name: "Pin open" }).click();
    await expect(inspect.getByRole("button", { name: "Unpin" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("p");
    await page.keyboard.press("c");
    expect(await page.getByTestId("production-babylon-match").getAttribute("data-revision")).toBe(revision);
    await inspect.getByRole("button", { name: "Close", exact: true }).click();
    const card = page.locator('[data-match-zone="hand"]').first();
    await card.focus(); await card.press("Enter");
    await expect(action).toContainText(/payment|cost/i);
    expect(await canvas.boundingBox()).toEqual(canvasBounds);
    expect(await action.boundingBox()).toEqual(actionBounds);
    await action.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await canvas.boundingBox()).toEqual(canvasBounds);
    expect(await action.boundingBox()).toEqual(actionBounds);
  }
});

test("light theme and reduced motion retain readable inspection on desktop and phones", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("gauntlet.matchTheme", "light"));
  await enterPractice(page, baseURL);
  for (const [width, height] of [[1366, 768], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await settle(page);
    const match = page.getByTestId("production-babylon-match");
    await expect(match).toHaveAttribute("data-match-theme", "light");
    await expect(match).toHaveClass(/reduced-motion/);
    await page.locator(".production-match-utilities > summary").click();
    await page.getByRole("button", { name: "Inspect hand", exact: true }).click();
    await page.getByRole("dialog", { name: "Inspect your hand" }).locator(".production-inspect-hand button").first().click();
    await expect(page.locator(".production-card-inspection")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`light-reduced-${width}x${height}.png`) });
    await page.locator(".production-card-inspection").getByRole("button", { name: "Close", exact: true }).click();
    // The menu remains open after a reference is dismissed.
    await page.locator(".production-match-utilities > summary").click();
  }
});

test("capture matching desktop polish scenes through normal practice", async ({ browser, baseURL }) => {
  test.skip(!process.env.DESKTOP_POLISH_CAPTURE, "Opt-in matched visual evidence.");
  test.setTimeout(240000);
  const phase = process.env.DESKTOP_POLISH_CAPTURE;
  if (!["before", "after"].includes(phase)) throw new Error("Capture phase must be before or after.");
  const output = path.join(root, phase);
  fs.mkdirSync(output, { recursive: true });
  const session = path.join(root, "session.json");
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 },
    ...(phase === "after" ? { storageState: session } : {}) });
  const page = await context.newPage();
  const external = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) {
      external.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  if (phase === "before") await enterPractice(page, baseURL);
  else {
    await page.goto(baseURL);
    await expect(page.getByTestId("production-babylon-match")).toHaveClass(/has-desktop-panels/);
  }
  await settle(page);
  if (phase === "after") {
    const baseline = JSON.parse(fs.readFileSync(path.join(root, "before/measurements.json"), "utf8"));
    const current = await metrics(page);
    expect(current.matchId).toBe(baseline.samples[0].matchId);
    expect(current.revision).toBe(baseline.samples[0].revision);
  }
  const report = { phase, browser: browser.version(), execution: "Headless Chromium on local Windows; GPU recorded per sample", samples: [] };
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await settle(page);
    await page.mouse.move(0, 0);
    const name = `${width}x${height}`;
    await page.screenshot({ path: path.join(output, `${name}-decision.png`) });
    report.samples.push({ state: "decision", ...await metrics(page) });
    const hand = page.locator('[data-match-zone="hand"]').first();
    await hand.focus();
    await hand.press("Enter");
    await settle(page);
    await page.evaluate(() => document.activeElement.blur());
    await page.mouse.move(0, 0);
    await expect(page.locator(".production-card-preview-art img")).toHaveJSProperty("complete", true);
    await expect(page.locator(".production-card-preview-art img")).not.toHaveJSProperty("naturalWidth", 0);
    await page.screenshot({ path: path.join(output, `${name}-selection.png`) });
    const action = page.getByRole("region", { name: "Current match action" });
    await expect(action.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await action.getByRole("button", { name: "Cancel", exact: true }).click();
    await hand.focus();
    await hand.press("i");
    await expect(page.locator(".production-card-inspection")).toBeVisible();
    await settle(page);
    await expect(page.locator(".production-inspection-card img")).toHaveJSProperty("complete", true);
    await page.screenshot({ path: path.join(output, `${name}-inspection.png`) });
    await page.locator(".production-card-inspection").getByRole("button", { name: "Close", exact: true }).click();
    await page.evaluate(() => document.activeElement.blur());
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const quality of ["performance", "balanced", "high", "ultra"]) {
    await page.locator(".production-match-utilities > summary").click();
    await page.getByLabel("Graphics quality", { exact: true }).selectOption(quality);
    await page.locator(".production-match-utilities > summary").click();
    await page.waitForTimeout(2400);
    report.samples.push({ state: "quality", ...await metrics(page) });
    await page.screenshot({ path: path.join(output, `1920x1080-${quality}.png`) });
  }
  await page.locator(".production-match-utilities > summary").click();
  await page.getByLabel("Graphics quality", { exact: true }).selectOption("balanced");
  await page.locator(".production-match-utilities > summary").click();
  if (phase === "before") await context.storageState({ path: session });
  report.blockedExternalOrigins = [...new Set(external)];
  fs.writeFileSync(path.join(output, "measurements.json"), JSON.stringify(report, null, 2));
  await context.close();
});

for (const width of [750, 1366]) test(`inspect, pay and submit a real attack at ${width}px, then read the next authoritative decision`, async ({ page, baseURL }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: 768 });
  await enterPractice(page, baseURL);
  await settle(page);
  const match = page.getByTestId("production-babylon-match");
  const revision = Number(await match.getAttribute("data-revision"));
  const cards = page.locator('[data-match-zone="hand"]');
  const choices = await cards.evaluateAll(elements => elements.map((element, index) => ({ index,
    value: Number(element.getAttribute("aria-label").match(/value\s+(\d+)/)?.[1] || 0) })).sort((a, b) => a.value - b.value));
  const card = cards.nth(choices[0].index);
  await card.focus(); await card.press("i");
  await expect(page.locator(".production-card-inspection")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("sequence-1-inspect.png") });
  await page.locator(".production-card-inspection").getByRole("button", { name: "Close", exact: true }).click();
  await card.focus(); await card.press("Enter");
  const action = page.getByRole("region", { name: "Current match action" });
  for (const payment of choices.slice(1).reverse()) {
    if (await page.locator(".production-payment-readout.is-complete").count()) break;
    await cards.nth(payment.index).focus(); await cards.nth(payment.index).press("Enter");
  }
  await expect(page.locator(".production-payment-readout.is-complete")).toBeVisible();
  await page.evaluate(() => document.activeElement.blur());
  await page.screenshot({ path: test.info().outputPath("sequence-2-payment.png") });
  await action.getByRole("button", { name: "Confirm Attack", exact: true }).click();
  await expect.poll(async () => Number(await match.getAttribute("data-revision"))).toBeGreaterThan(revision);
  await page.screenshot({ path: test.info().outputPath("sequence-3-accepted.png") });
  await expect(page.getByRole("status", { name: "Latest combat summary", includeHidden: true })).toBeAttached({ timeout: 30000 });
  if (width <= 900) {
    await page.getByRole("button", { name: /^Full log ·/ }).click();
    await expect(page.getByRole("dialog", { name: "Match log" })).toContainText(/damage/i);
    await page.getByRole("dialog", { name: "Match log" }).getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.screenshot({ path: test.info().outputPath("sequence-4-resolution.png") });
  await settle(page);
  await expect(action).not.toHaveAttribute("aria-busy", "true");
  await expect(action).not.toContainText("Waiting for the server");
  await page.screenshot({ path: test.info().outputPath("sequence-5-next-decision.png") });
});

test("windowed HUD keeps payment controls and the battlefield stable as history and inspection change", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 750, height: 740 });
  await enterPractice(page, baseURL);
  for (const [width, height] of [[601, 700], [750, 740], [900, 800], [1099, 820]]) {
    await page.setViewportSize({ width, height });
    await settle(page);
    await expect(page.getByTestId("production-babylon-match")).toHaveClass(/has-windowed-panels/);
    const canvas = page.locator("canvas.babylon-match-canvas");
    const bounds = await canvas.boundingBox();
    const action = page.getByRole("region", { name: "Current match action" });
    const actionBounds = await action.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThan(actionBounds.y);
    const ledger = page.getByRole("complementary", { name: "Recent play order" });
    await expect(ledger.getByRole("button", { name: "Play order", exact: true })).toHaveAttribute("aria-expanded", "false");
    const card = page.locator('[data-match-zone="hand"]').first();
    await card.focus(); await card.press("Enter");
    await settle(page);
    expect(await canvas.boundingBox()).toEqual(bounds);
    expect(await action.boundingBox()).toEqual(actionBounds);
    const payment = await page.locator(".production-payment-readout > strong").boundingBox();
    const copy = await page.locator(".production-context-copy").boundingBox();
    expect(payment.y + payment.height).toBeLessThanOrEqual(copy.y + copy.height);
    await expect(action.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    await page.evaluate(() => document.activeElement.blur());
    await page.mouse.move(0, 0);
    await expect(page.locator(".production-card-preview")).toHaveCount(0);
    await card.focus(); await card.press("i");
    await expect(page.locator(".production-card-inspection")).toBeVisible();
    await page.locator(".production-card-inspection").getByRole("button", { name: "Close", exact: true }).click();
    await action.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.evaluate(() => document.activeElement.blur());
    await page.mouse.move(0, 0);
    await expect(page.locator(".production-card-preview")).toHaveCount(0);
    const mode = await page.locator(".production-mode-marker").boundingBox();
    const log = await ledger.boundingBox();
    expect(mode.x + mode.width).toBeLessThanOrEqual(log.x);
    await page.screenshot({ path: test.info().outputPath(`windowed-${width}x${height}.png`) });
  }
});

test("measure CSS pixels, render buffers and actual idle paints in each profile", async ({ browser, baseURL }) => {
  test.skip(!process.env.DESKTOP_POLISH_PROFILE, "Opt-in measurement, not a target-device performance gate.");
  test.setTimeout(180000);
  const samples = [];
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
    await context.addInitScript(() => {
      let painted = false;
      window.paintProbe = { enabled: false, callbacks: [], paints: [] };
      for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!type) continue;
        for (const method of ["drawElements", "drawArrays"]) {
          const original = type.prototype[method];
          type.prototype[method] = function (...args) {
            if (this.canvas.matches?.(".babylon-match-canvas")) painted = true;
            return original.apply(this, args);
          };
        }
      }
      function frame(now) {
        if (window.paintProbe.enabled) {
          window.paintProbe.callbacks.push(now);
          if (painted) window.paintProbe.paints.push(now);
        }
        painted = false;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const page = await context.newPage();
    await enterPractice(page, baseURL);
    await settle(page);
    for (const quality of ["performance", "balanced", "high", "ultra"]) {
      await page.locator(".production-match-utilities > summary").click();
      await page.getByLabel("Graphics quality", { exact: true }).selectOption(quality);
      await page.locator(".production-match-utilities > summary").click();
      await page.waitForTimeout(1500);
      await page.evaluate(() => { window.paintProbe = { enabled: true, callbacks: [], paints: [] }; });
      await page.waitForTimeout(5000);
      const probe = await page.evaluate(() => {
        window.paintProbe.enabled = false;
        const { callbacks, paints } = window.paintProbe;
        const deltas = paints.slice(1).map((time, i) => time - paints[i]).sort((a, b) => a - b);
        return { callbackFps: (callbacks.length - 1) * 1000 / (callbacks.at(-1) - callbacks[0]),
          actualPaintFps: (paints.length - 1) * 1000 / (paints.at(-1) - paints[0]),
          paintIntervalP95Ms: deltas[Math.ceil(deltas.length * .95) - 1], maxPaintIntervalMs: deltas.at(-1) };
      });
      samples.push({ ...await metrics(page), ...probe });
    }
    await context.close();
  }
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "profile-measurements.json"), JSON.stringify({ browser: browser.version(), samples }, null, 2));
  for (const sample of samples.filter(sample => sample.graphics === "high")) {
    expect(sample.buffer).toEqual(sample.css);
  }
});
