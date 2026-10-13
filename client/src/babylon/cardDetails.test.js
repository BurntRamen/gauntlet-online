import { readableMatchCards } from "./cardDetails";

test("pinned details resolve only against currently readable projected identities", () => {
  const own = { id: "own", visible: true, raw: { value: 7 } };
  const publicCard = { id: "public", visible: true, valueBreakdown: { total: 9 } };
  const hidden = { id: "secret", visible: false, raw: { name: "Must not appear" } };
  expect(readableMatchCards({ hand: [own], lanes: [{ localCard: own, opponentCard: hidden }],
    attacks: [{ card: publicCard, blocks: [{ card: { id: "hidden-block", raw: { hidden: true } } }] }] }))
    .toEqual([publicCard, own]);
  expect(readableMatchCards({ hand: [], lanes: [{ localCard: hidden }] })).toEqual([]);
});
