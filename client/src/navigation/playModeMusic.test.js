import { usesPlayModeMusic } from "./playModeMusic";

test.each([
  [{ page: "play", view: "" }, false],
  [{ page: "play", view: "tables" }, true],
  [{ page: "play", view: "practice" }, true],
  [{ page: "compete", view: "" }, false],
  [{ page: "compete", view: "ranked" }, true],
  [{ page: "compete", view: "events" }, false],
  [{ page: "draft", view: "" }, true],
  [{ page: "draft", view: "sealed" }, true],
  [{ page: "campaign", view: "" }, false],
])("usesPlayModeMusic(%o) is %s", (route, expected) => {
  expect(usesPlayModeMusic(route)).toBe(expected);
});
