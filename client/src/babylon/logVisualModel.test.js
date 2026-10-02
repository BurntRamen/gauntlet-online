import { logCardToken, logSourceToken, visualMatchLog } from "./logVisualModel";

const players = {
  1: { name: "Ada", faction: { id: "sheen", commander: { name: "Emperor Nu", image: "/nu.webp" }, general: { name: "Tang", image: "/tang.webp" } } },
  2: { name: "Bo", faction: { id: "rumin", city: { name: "Rume", image: "/rume.webp" }, general: { name: "Kaiser, the Jewel", image: "/kaiser.webp" } } }
};
const tokens = (entry, context = players) => visualMatchLog(entry, context).groups.flat();

test("distinguishes plain playing cards, faction faces, and static faction portraits", () => {
  expect(logCardToken({ rank: "7", suit: "hearts" }, "basic")).toMatchObject({ rank: "7", suit: "♥", art: "" });
  expect(logCardToken({ type: "playing-card", rank: "7", suit: "♥" }, "sheen")).toMatchObject({ art: "/assets/gauntlet/playing-cards/sheen-7-hearts.webp" });
  expect(logCardToken({ rank: "7", suit: "♥", presentation: { face: "/immutable-face.webp" } }, "basic").art).toBe("/immutable-face.webp");
  expect(logSourceToken("Emperor Nu", players, 1)).toMatchObject({ role: "commander", art: "/nu.webp" });
  expect(logSourceToken("Kaiser", players, 2)).toMatchObject({ role: "general", art: "/kaiser.webp" });
  expect(logSourceToken("Rume", players, 2)).toMatchObject({ role: "city", art: "/rume.webp" });
  expect(logSourceToken("An unknown ability", players, 1)).toMatchObject({ role: "ability", art: "" });
});

test("renders exact recorded card adjustments and never borrows a bonus from the current faction", () => {
  const entry = { type: "attack.declared", player: 1, targetPlayer: 2, attackValue: 7,
    calculation: { attack: { card: { rank: "5", suit: "♣" }, baseValue: 5, effectiveValue: 7, notes: ["Emperor Nu +2"] } } };
  expect(tokens(entry)).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "card", rank: "5" }),
    expect.objectContaining({ kind: "source", label: "Emperor Nu", role: "commander" }),
    expect.objectContaining({ kind: "bonus", value: 2 }),
    expect.objectContaining({ kind: "number", value: 7, icon: "attack" }),
    expect.objectContaining({ kind: "player", value: 2 })
  ]));
  expect(tokens({ type: "attack.declared", player: 1, attackValue: 7 }).some(t => t.kind === "bonus")).toBe(false);
  entry.calculation.attack.notes = ["Emperor Nu +3"];
  expect(tokens(entry).filter(t => t.kind === "bonus").map(t => t.value)).toEqual([2]);
  expect(tokens(entry).some(t => t.kind === "source")).toBe(false);
});

test("represents payment cards, pitch bonuses, cost reductions and a zero cost independently", () => {
  const result = tokens({ type: "payment.discarded", player: 2, total: 6, required: 0,
    calculation: { cards: [{ rank: "4", suit: "♦", value: 4 }], notes: ["Pitch +2"], reductions: [{ source: "Rume", amount: 1 }] } });
  expect(result.filter(t => t.kind === "bonus").map(t => t.value)).toEqual([2, -1]);
  expect(result).toContainEqual(expect.objectContaining({ kind: "number", value: 0, label: "Cost" }));
});

test("keeps known zero and unknown damage values distinct and attributes life loss to the target", () => {
  const result = tokens({ type: "damage.calculated", attackValue: 7, blockValue: 5, prevented: 2, damage: 0 });
  expect(result.filter(t => t.kind === "number").map(t => t.value)).toEqual([7, 5, 2, 0]);
  expect(tokens({ type: "damage.calculated" }).filter(t => t.kind === "number").map(t => t.value)).toEqual(["?", "?", "?"]);
  expect(visualMatchLog({ type: "damage.dealt", player: 1, targetPlayer: 2, damage: 4 }).owner).toBe(2);
});

test("does not reveal hidden draw, placement, or private-effect identities", () => {
  const secret = { id: "secret-card-id", name: "Secret card", rank: "A", suit: "♠", hidden: true };
  expect(logCardToken(secret, "sheen")).toEqual({ kind: "card", hidden: true, label: "Face-down card" });
  for (const type of ["cards.drawn", "card.placedFacedown"]) {
    const result = JSON.stringify(visualMatchLog({ type, card: secret, cardIds: [secret.id], laneIndex: 0 }));
    expect(result).not.toContain(secret.id);
    expect(result).not.toContain(secret.name);
    expect(result).not.toContain('"rank"');
  }
  expect(visualMatchLog({ type: "effect.applied", private: true, target: { name: "Secret card" }, amount: 2 }).groups).toEqual([]);
  expect(tokens({ type: "cards.drawn" }).find(t => t.kind === "bonus").value).toBe("?");
});

test("shows all blockers, their bonuses, and the recorded combined block", () => {
  const receipt = { card: { rank: "3", suit: "♣" }, baseValue: 3, effectiveValue: 5, notes: ["Emperor Nu +2"] };
  const result = tokens({ type: "block.declared", player: 1, totalBlock: 10, calculation: { blocks: [receipt, receipt] } });
  expect(result.filter(t => t.kind === "card")).toHaveLength(2);
  expect(result).toContainEqual(expect.objectContaining({ value: 10, label: "Total block" }));
});

test("keeps the general's portrait with a healing effect", () => {
  expect(tokens({ type: "life.gained", source: "Tang", player: 1, amount: 2 })).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "source", role: "general", label: "Tang", art: "/tang.webp" }),
    expect.objectContaining({ kind: "number", icon: "life", value: 2 })
  ]));
});
