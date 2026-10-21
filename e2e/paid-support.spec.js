const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { io } = require("socket.io-client");
const API = "http://127.0.0.1:4128";
function connectedPeer(fixture) {
  const socket = io(API, { transports: ["websocket"], forceNew: true });
  const ready = new Promise(resolve => socket.once("assign", resolve));
  socket.on("connect", () => socket.emit("reconnectToRoom", { roomCode: fixture.roomCode, reconnectToken: fixture.tokens[2] }));
  return { socket, ready };
}
async function enter(page, request, renderer) {
  const fixture = await (await request.post(`${API}/__support/seed`)).json();
  const peer = connectedPeer(fixture); await peer.ready;
  await page.addInitScript(({ roomCode, tokens }) => {
    localStorage.setItem("gauntlet_room_code", roomCode);
    localStorage.setItem("gauntlet_reconnect_token", tokens[1]);
    localStorage.setItem("gauntlet_role", "player");
    localStorage.setItem("gauntlet_guest_name", "Support Player 1");
  }, fixture);
  await page.goto(`/?renderer=${renderer}`);
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  return { fixture, peer };
}
async function settle(page, revision) {
  if (revision != null) await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-revision", String(revision));
  await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-playback-catching-up", "false");
  await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-gameplay-input-locked", "false");
}
async function hand(page, index) {
  const rail = page.getByTestId("phone-hand-rail");
  const button = await rail.isVisible() ? rail.locator(`[data-card-index="${index}"]`) : page.locator(`.babylon-accessible-controls [data-card-index="${index}"]`);
  // Desktop controls intentionally reveal on keyboard focus.
  await button.focus(); await button.press("Enter");
}
for (const [name, renderer, viewport] of [["desktop Babylon", "babylon", { width: 1440, height: 900 }], ["phone Babylon", "babylon", { width: 390, height: 844 }], ["React fallback", "react", { width: 1024, height: 768 }]]) {
  test(`${name}: paid support, repeated instant, optional choice, persistence and reconnect`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    const { fixture, peer } = await enter(page, request, renderer);
    try {
      await settle(page, 0);
      const primary = page.getByRole("region", { name: "Current match action" });
      await hand(page, 0);
      await expect(primary.getByRole("button", { name: "Play Support", exact: true })).toBeDisabled();
      await hand(page, 4); // 2 is insufficient for printed 7.
      await expect(primary.getByRole("button", { name: "Play Support", exact: true })).toBeDisabled();
      await hand(page, 5); // 2+5 exactly pays.
      await page.evaluate(() => {
        window.supportBeats = [];
        const root = document.querySelector('[data-testid="production-babylon-match"]');
        new MutationObserver(() => {
          const type = root.getAttribute("data-active-event-type");
          if (type && window.supportBeats.at(-1) !== type) window.supportBeats.push(type);
        }).observe(root, { attributes: true, attributeFilter: ["data-active-event-type"] });
      });
      await primary.getByRole("button", { name: "Play Support", exact: true }).click();
      await settle(page, 1);
      const beats = await page.evaluate(() => window.supportBeats);
      expect(beats.indexOf("card.supportPlaced")).toBeGreaterThanOrEqual(0);
      expect(beats.indexOf("support.discarded")).toBeGreaterThan(beats.indexOf("card.supportPlaced"));
      let state = await (await request.get(`${API}/__support/state/${fixture.roomCode}`)).json();
      expect(state.game.revision).toBe(1); expect(state.game.lanes[0].support[1]).toBeNull();
      expect(state.game.players[1].discard.map(c => c.id)).toEqual(expect.arrayContaining(["support-0", "pay-0", "pay-1"]));
      await hand(page, 0); await hand(page, 3); // second instant and remaining 7.
      await primary.getByRole("button", { name: "Play Support", exact: true }).click(); await settle(page, 2);
      state = await (await request.get(`${API}/__support/state/${fixture.roomCode}`)).json();
      expect(state.game.players[1].turnData.frumoNextActionBonus).toBe(2);
      await hand(page, 0); await hand(page, 2); // Deep Dive, optional peek declined.
      await primary.getByRole("button", { name: "Play Support", exact: true }).click(); await settle(page, 3);
      state = await (await request.get(`${API}/__support/state/${fixture.roomCode}`)).json();
      expect(state.game.lanes[0].support[1].definitionId).toBe("frumo-deckhand-diver");
      expect(state.replay.lanes[0].support[1].hidden).toBe(true);
      await hand(page, 0); await hand(page, 1); // persistent Hospital uses next empty zone.
      await primary.getByRole("button", { name: "Play Support", exact: true }).click(); await settle(page, 4);
      state = await (await request.get(`${API}/__support/state/${fixture.roomCode}`)).json();
      expect(state.game.lanes[1].support[1].definitionId).toBe("neutral-hospital");
      expect(state.replay.lanes[1].support[1].name).toBe("Hospital");
      await request.post(`${API}/__support/recover`);
      peer.socket.emit("reconnectToRoom", { roomCode: fixture.roomCode, reconnectToken: fixture.tokens[2] });
      await page.reload(); await settle(page, 4);
      await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-revision", "4");
      await expect(page.locator("body")).not.toContainText("Unknown support");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).include('[data-testid="production-babylon-match"]').withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(accessibility.violations.filter(v => ["critical", "serious"].includes(v.impact))).toEqual([]);
      await page.screenshot({ path: `test-results/support-${renderer}-${viewport.width}.png` });
    } finally { peer.socket.disconnect(); }
  });
}

test("training opponent pays for support through the live session and exposes public slot inspection", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await (await request.post(`${API}/__support/seed`, { data: { trainingAi: true } })).json();
  await page.addInitScript(({ roomCode, tokens }) => {
    localStorage.setItem("gauntlet_room_code", roomCode);
    localStorage.setItem("gauntlet_reconnect_token", tokens[1]);
    localStorage.setItem("gauntlet_role", "player");
  }, fixture);
  await page.goto("/");
  await settle(page, 0);
  await page.getByRole("region", { name: "Current match action" })
    .getByRole("button", { name: "Pass Priority", exact: true }).click();
  await expect.poll(async () => {
    const state = await (await request.get(`${API}/__support/state/${fixture.roomCode}`)).json();
    return state.game.lanes[0].support?.[2]?.id;
  }).toBe("ai-hospital");
  await settle(page, 3);
  const state = await (await request.get(`${API}/__support/state/${fixture.roomCode}`)).json();
  expect(state.game.players[2].discard.map(card => card.id)).toEqual(["ai-payment"]);
  expect(state.game.paymentLog.at(-1)).toMatchObject({ type: "support", player: 2, required: 6, total: 6 });
  const inspection = page.getByRole("button", { name: "Opponent Support Zone 1: Hospital", exact: true });
  await inspection.focus();
  await inspection.press("Enter");
  await expect(page.getByRole("dialog", { name: /Inspect/ })).toContainText("Hospital");
  await expect(page.getByRole("dialog", { name: /Inspect/ })).not.toContainText("Attack/block");
  await page.screenshot({ path: "test-results/support-training-ai-phone.png" });
});
