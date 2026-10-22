const test = require("node:test"), assert = require("node:assert/strict");
const { createAdminData } = require("../adminData");
test("Home reports pinned Para operation state, digital purchases and unreadable sources explicitly", async () => {
  let unavailable = false;
  const data = createAdminData({ useSupabase: () => true, request: async () => [{ id: "player", name: "Buyer", stats: {} }],
    persistence: { getMode: async () => { throw new Error("Unavailable health fixture"); }, status: () => ({}) }, archive: { probe: async () => false, status: () => ({}) },
    runtime: { season: () => ({ seasonId: "ranked" }), progression: () => ({}), collection: () => ({}), decks: () => ({ decks: [] }) },
    publication: { status: () => ({ live: { domains: { offers: [] }, paraLeague: { events: [{ id: "event", name: "Changed draft name", status: "scheduled" }] } } }) },
    gold: { enabled: true, status: () => ({ enabled: true }), inspectAccount: () => ({ purchases: [{ id: "receipt", product: { name: "Publication" }, gold: 25, at: "2030-01-01T00:00:00.000Z" }] }) },
    para: { enabled: true, status: () => ({ enabled: true }), inspect: () => { if (unavailable) throw new Error("private-storage-detail"); return { events: [{ id: "event", definition: { id: "event", name: "Pinned event" }, status: "paused" }], failures: [{}] }; } }
  });
  let home = await data.home();
  assert.equal(home.events.find(e => e.id === "event").name, "Pinned event");
  assert.match(home.events.find(e => e.id === "event").availability.label, /paused.*pinned/);
  assert.equal(home.purchases[0].price, 25); assert.equal(home.purchases[0].productName, "Publication");
  assert.ok(home.tasks.some(t => /settlement/.test(t.title)));
  assert.ok(home.events.filter(e => e.id !== "event").every(e => /cutover/.test(e.availability.label)));
  unavailable = true; home = await data.home();
  assert.match(home.events.find(e => e.id === "event").availability.label, /unavailable/);
  assert.ok(home.tasks.some(t => /Para runtime is unavailable/.test(t.message)));
  assert.equal(JSON.stringify(home).includes("private-storage-detail"), false);
});
