const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const OUTPUT_DIRECTORY = path.resolve(
  process.env.BABYLON_REVIEW_OUTPUT || "artifacts/babylon-visual-review/current"
);

const VIEWPORTS = [
  { id: "1920x1080", width: 1920, height: 1080 },
  { id: "1536x864", width: 1536, height: 864 },
  { id: "1366x768", width: 1366, height: 768 },
  { id: "ultrawide", width: 2560, height: 1080 },
  { id: "tablet-landscape", width: 1180, height: 820 },
  { id: "tablet-portrait", width: 820, height: 1180 },
  { id: "phone-landscape", width: 844, height: 390 },
  { id: "phone-portrait", width: 390, height: 844 }
];

const STATES = [
  { id: "neutral-battlefield", fixture: "populated-priority", motion: false },
  { id: "local-priority", fixture: "populated-priority", motion: true },
  { id: "attack-selection", fixture: "select-attacker", motion: true },
  { id: "payment-selection", fixture: "select-payment", motion: true },
  { id: "hand-attack", fixture: "incoming-hand", motion: true },
  { id: "lane-attack", fixture: "lane-attack", motion: true },
  { id: "multiple-hand-blockers", fixture: "select-blockers", motion: true },
  { id: "same-lane-block", fixture: "same-lane-block", motion: true },
  { id: "damage", fixture: "damage-resolution", motion: true },
  { id: "placement", fixture: "end-placement", motion: true },
  { id: "draw", fixture: "card-draw", motion: true },
  { id: "priority-transfer", fixture: "priority-change", motion: true },
  {
    id: "constructed-choice",
    fixture: "constructed-choice",
    mode: "factions",
    playerOneFaction: "rumin",
    playerTwoFaction: "sheen",
    motion: true
  },
  {
    id: "faction-ability",
    fixture: "faction-ability",
    mode: "factions",
    playerOneFaction: "frumo",
    playerTwoFaction: "sheen",
    motion: true
  },
  {
    id: "disconnect",
    fixture: "populated-priority",
    connection: "disconnected",
    motion: false
  },
  { id: "reconnect-restored", fixture: "populated-priority", motion: false },
  { id: "victory", fixture: "victory", motion: true },
  { id: "defeat", fixture: "defeat", motion: true },
  { id: "draw-result", fixture: "draw", motion: true }
];

function reviewUrl(baseURL, state) {
  const query = new URLSearchParams({
    "babylon-test": "1",
    review: "1",
    fixture: state.fixture,
    seed: "production-review-v1"
  });
  if (state.mode) query.set("mode", state.mode);
  if (state.playerOneFaction) query.set("p1", state.playerOneFaction);
  if (state.playerTwoFaction) query.set("p2", state.playerTwoFaction);
  if (state.connection) query.set("connection", state.connection);
  return `${baseURL}/?${query}`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildIndex(manifest) {
  const sections = manifest.states.map((state) => {
    const captures = state.captures.map((capture) => `
      <figure>
        <a href="${htmlEscape(capture.file)}"><img src="${htmlEscape(capture.file)}" alt="${htmlEscape(state.id)} at ${htmlEscape(capture.viewport)}"></a>
        <figcaption>
          <strong>${htmlEscape(capture.viewport)}</strong>
          <span>${capture.canvas.width}×${capture.canvas.height} canvas</span>
          <span>${htmlEscape(capture.phase)} · ${htmlEscape(capture.instruction)}</span>
        </figcaption>
      </figure>
    `).join("");
    const motion = state.motionCapture
      ? `<figure><a href="${htmlEscape(state.motionCapture)}"><img src="${htmlEscape(state.motionCapture)}" alt="${htmlEscape(state.id)} motion sample"></a><figcaption><strong>Motion sample</strong></figcaption></figure>`
      : "";
    return `
      <section>
        <h2>${htmlEscape(state.id)}</h2>
        <p><code>${htmlEscape(state.url)}</code></p>
        <div class="captures">${motion}${captures}</div>
        <table>
          <thead><tr><th>Rule clarity</th><th>Spacing</th><th>Readability</th><th>Hierarchy</th><th>Feedback</th><th>Brand</th><th>Animation</th></tr></thead>
          <tbody><tr><td>Human pending</td><td>Human pending</td><td>Human pending</td><td>Human pending</td><td>Human pending</td><td>Human pending</td><td>Human pending</td></tr></tbody>
        </table>
      </section>
    `;
  }).join("");
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Babylon visual approval review</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background:#0a0e13; color:#e6e1d1; }
      body { margin:0 auto; max-width:1800px; padding:28px; }
      header,section { padding:20px; margin:0 0 24px; border:1px solid #2a313c; border-radius:10px; background:#12161d; }
      h1,h2 { margin-top:0; } code { color:#78a8ff; }
      .captures { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px; }
      figure { margin:0; padding:10px; border:1px solid #394451; border-radius:8px; background:#080c11; }
      img { display:block; width:100%; height:auto; border-radius:5px; }
      figcaption { display:grid; gap:3px; padding-top:8px; color:#aeb8c2; font-size:12px; }
      table { width:100%; margin-top:14px; border-collapse:collapse; font-size:12px; }
      th,td { padding:8px; border:1px solid #35404b; text-align:left; }
      th { color:#d6ae72; } td { color:#aeb8c2; }
    </style>
  </head>
  <body>
    <header>
      <h1>Babylon visual-state approval</h1>
      <p>Generated ${htmlEscape(manifest.generatedAt)} · rules ${htmlEscape(manifest.rulesVersion || "unknown")}</p>
      <p>Automated capture is evidence, not human approval. Every category remains pending until reviewed.</p>
    </header>
    ${sections}
  </body>
  </html>`;
}

test("capture the complete production visual-state approval matrix", async ({ page, baseURL }) => {
  test.setTimeout(300000);
  fs.rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    rulesVersion: null,
    seed: "production-review-v1",
    states: []
  };

  for (const state of STATES) {
    const url = reviewUrl(baseURL, state);
    const stateRecord = {
      id: state.id,
      fixture: state.fixture,
      url,
      motionCapture: null,
      captures: []
    };

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(url);
    await expect(page.getByTestId("production-babylon-match")).toBeVisible();
    await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();

    if (state.id === "faction-ability") {
      const poleaButton = page.locator(".production-faction-actions")
        .getByRole("button", { name: /Polea · move or switch lanes/i });
      await expect(poleaButton).toBeVisible();
      await expect(poleaButton).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".production-context-copy")).toContainText(/choose two lanes/i);
    }
    if (state.id === "disconnect") {
      await expect(page.locator(".production-connection-banner")).toBeVisible();
      await expect(page.locator(".production-context-copy")).toContainText(/connection interrupted/i);
      await expect(page.getByRole("region", { name: "Current match action" })
        .getByRole("button", { name: /pass/i })).toBeDisabled();
    }
    if (state.id === "lane-attack") {
      await expect(page.locator(".production-context-copy")).toContainText(/lane/i);
      await expect(page.getByText("Lane 2 attack committed", { exact: true })).toBeVisible();
    }
    if (state.id === "hand-attack") {
      await expect(page.getByText("Hand attack committed", { exact: true })).toBeVisible();
    }
    if (state.id === "multiple-hand-blockers") {
      await expect(page.locator(".production-context-copy")).toContainText(/block|payment/i);
    }

    if (state.motion) {
      await page.waitForTimeout(140);
      const motionFile = `${state.id}--motion--1366x768.jpg`;
      await page.screenshot({
        path: path.join(OUTPUT_DIRECTORY, motionFile),
        type: "jpeg",
        quality: 86
      });
      stateRecord.motionCapture = motionFile;
    }

    await page.waitForTimeout(850);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(100);
      const file = `${state.id}--final--${viewport.id}.jpg`;
      const canvas = await page.locator("canvas.babylon-match-canvas").evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight
      }));
      const match = page.getByTestId("production-babylon-match");
      const instruction = await page.locator(".production-context-copy strong").first().textContent()
        || await page.locator(".production-context-panel strong").first().textContent()
        || "";
      const phase = await page.locator(".production-turn-marker strong").textContent() || "";
      const revision = await match.getAttribute("data-revision");
      const rulesVersion = await match.getAttribute("data-rules-version");
      manifest.rulesVersion ||= rulesVersion;

      expect(canvas.width).toBeGreaterThan(300);
      expect(canvas.height).toBeGreaterThan(250);
      await expect(page.locator(".production-player-plate")).toHaveCount(2);
      if (viewport.id === "phone-portrait") {
        await expect(page.getByText("Rotate to landscape for the 3D battlefield")).toBeVisible();
        await expect(page.getByRole("region", { name: "Keyboard match controls" })).toBeAttached();
      } else {
        await expect(page.locator(".production-context-panel")).toBeVisible();
      }
      await page.screenshot({
        path: path.join(OUTPUT_DIRECTORY, file),
        type: "jpeg",
        quality: 86
      });
      stateRecord.captures.push({
        file,
        viewport: viewport.id,
        canvas,
        phase,
        instruction: instruction.trim(),
        revision: Number(revision || 0),
        rulesVersion
      });
    }
    manifest.states.push(stateRecord);
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, "index.html"),
    buildIndex(manifest)
  );
});
