const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const OUTPUT_DIRECTORY = path.resolve("artifacts/babylon-performance");

function percentile(values, percentage) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * percentage) - 1)];
}

async function collectSample(browser, baseURL, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const startedAt = Date.now();
  await page.goto(`${baseURL}/?babylon-test=1&seed=production-performance`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
  await expect(page.locator(".production-context-panel")).toBeVisible();
  const usableSceneMs = Date.now() - startedAt;
  await page.waitForTimeout(250);
  const browserMetrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    return {
      heapBytes: performance.memory?.usedJSHeapSize || 0,
      scriptEncodedBytes: resources
        .filter((entry) => entry.initiatorType === "script")
        .reduce((total, entry) => total + (entry.encodedBodySize || 0), 0),
      scriptResourceCount: resources.filter((entry) => entry.initiatorType === "script").length
    };
  });
  await context.close();
  return { usableSceneMs, ...browserMetrics };
}

test("compiled Babylon client meets local cold-load performance safeguards", async ({ browser, baseURL }) => {
  const profiles = [
    {
      id: "desktop",
      viewport: { width: 1366, height: 768 },
      samples: 10,
      p95BudgetMs: 3000
    },
    {
      id: "phone-landscape-emulation",
      viewport: { width: 844, height: 390 },
      samples: 5,
      p95BudgetMs: 5000
    }
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    source: "local compiled-client cold-load safeguard",
    targetHardwareQualificationRequired: true,
    profiles: []
  };

  for (const profile of profiles) {
    const samples = [];
    for (let index = 0; index < profile.samples; index += 1) {
      samples.push(await collectSample(browser, baseURL, profile.viewport));
    }
    const usableSceneValues = samples.map((sample) => sample.usableSceneMs);
    const p95UsableSceneMs = percentile(usableSceneValues, 0.95);
    report.profiles.push({
      ...profile,
      p95UsableSceneMs,
      maxHeapBytes: Math.max(...samples.map((sample) => sample.heapBytes)),
      maxScriptEncodedBytes: Math.max(...samples.map((sample) => sample.scriptEncodedBytes)),
      samples
    });
    expect(p95UsableSceneMs).toBeLessThan(profile.p95BudgetMs);
  }

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, "current.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
});
