const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const OUTPUT_DIRECTORY = path.resolve("artifacts/babylon-performance");

function percentile(values, percentage) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * percentage) - 1)];
}

async function openTrainingGrounds(page, baseURL, sampleId) {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator('button[data-area="identity"]').click();
  await page.getByLabel("Play as guest").check();
  await page.getByPlaceholder("Guest name").fill(`Perf ${sampleId.slice(-14)}`);
  await page.locator('button[data-area="play"]').click();
  await page.getByRole("tab", { name: "Practice" }).click();
  await expect(page.getByRole("button", { name: /Basic vs AI/ })).toBeEnabled();
}

async function collectSample(browser, baseURL, viewport, sampleId) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await openTrainingGrounds(page, baseURL, sampleId);
  const startedAt = Date.now();
  await page.getByRole("button", { name: /Basic vs AI/ }).click();
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
  await expect(page.locator(".production-context-panel")).toBeVisible();
  await expect(page.getByTestId("production-babylon-match")).not.toHaveAttribute("data-scene-mesh-count", "");
  const usableSceneMs = Date.now() - startedAt;
  await page.waitForTimeout(250);
  const browserMetrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const match = document.querySelector('[data-testid="production-babylon-match"]');
    const canvas = document.querySelector("canvas.babylon-match-canvas");
    return {
      heapBytes: performance.memory?.usedJSHeapSize || 0,
      scriptEncodedBytes: resources
        .filter((entry) => entry.initiatorType === "script")
        .reduce((total, entry) => total + (entry.encodedBodySize || 0), 0),
      scriptResourceCount: resources.filter((entry) => entry.initiatorType === "script").length,
      sceneMeshCount: Number(match?.dataset.sceneMeshCount || 0),
      frozenBoardMeshCount: Number(match?.dataset.frozenBoardMeshCount || 0),
      graphicsQuality: match?.dataset.graphicsQuality || "",
      hardwareScalingLevel: Number(match?.dataset.hardwareScalingLevel || 0),
      canvasBufferPixels: Number(canvas?.width || 0) * Number(canvas?.height || 0),
      canvasCssPixels: Number(canvas?.clientWidth || 0) * Number(canvas?.clientHeight || 0)
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
      samples.push(await collectSample(browser, baseURL, profile.viewport, `${profile.id}-${index}`));
    }
    const usableSceneValues = samples.map((sample) => sample.usableSceneMs);
    const p95UsableSceneMs = percentile(usableSceneValues, 0.95);
    report.profiles.push({
      ...profile,
      p95UsableSceneMs,
      maxHeapBytes: Math.max(...samples.map((sample) => sample.heapBytes)),
      maxScriptEncodedBytes: Math.max(...samples.map((sample) => sample.scriptEncodedBytes)),
      maxSceneMeshCount: Math.max(...samples.map((sample) => sample.sceneMeshCount)),
      minFrozenBoardMeshCount: Math.min(...samples.map((sample) => sample.frozenBoardMeshCount)),
      maxCanvasBufferPixels: Math.max(...samples.map((sample) => sample.canvasBufferPixels)),
      samples
    });
    expect(p95UsableSceneMs).toBeLessThan(profile.p95BudgetMs);
    expect(Math.max(...samples.map((sample) => sample.sceneMeshCount))).toBeLessThan(520);
    expect(Math.min(...samples.map((sample) => sample.frozenBoardMeshCount))).toBeGreaterThan(300);
    expect(Math.max(...samples.map((sample) => sample.canvasBufferPixels))).toBeLessThanOrEqual(910000);
    expect(samples.every((sample) => sample.graphicsQuality === "balanced")).toBe(true);
  }

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, "current.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
});
