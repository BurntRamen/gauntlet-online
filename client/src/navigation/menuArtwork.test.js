import { ACTION_ART } from "./menuArtwork";

test("different menu actions have distinct illustration assets", () => {
  const assignments = Object.values(ACTION_ART);
  expect(new Set(assignments).size).toBe(assignments.length);
  expect(ACTION_ART.rulebook).not.toEqual(ACTION_ART.lore);
  expect(ACTION_ART["faction-ai"]).not.toMatch(/kaiser|rumin|sheen|frumo|bizi/);
});
