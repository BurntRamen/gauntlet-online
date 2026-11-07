import { readWorkshopPreferences, saveWorkshopPreferences } from "./workshopPreferences";
beforeEach(() => localStorage.clear());
test("resumption stores bounded navigation context and no field buffers or credentials", () => {
  saveWorkshopPreferences({ cards: { query: "Spear", scroll: 800, buffers: { name: "Secret local edit" }, token: "secret" } }, { domain: "cards", id: "spear", section: "mechanics", localText: "hidden" }, "Spear");
  const value = readWorkshopPreferences();
  expect(value.contexts.cards).toEqual({ query: "Spear", campaign: "", scroll: 800 });
  expect(value.recent[0]).toEqual({ target: { domain: "cards", id: "spear", section: "mechanics" }, label: "Spear" });
  expect(localStorage.getItem("gauntlet.admin.workspace.v1")).not.toMatch(/Secret|secret|hidden/);
});
test("corrupt or disabled device storage never prevents editing", () => {
  localStorage.setItem("gauntlet.admin.workspace.v1", '{"version":1,"contexts":{"cards":null},"recent":[null]}');
  expect(readWorkshopPreferences()).toEqual({ contexts: {}, recent: [] });
  localStorage.setItem("gauntlet.admin.workspace.v1", "bad json"); expect(readWorkshopPreferences().recent).toEqual([]);
});
