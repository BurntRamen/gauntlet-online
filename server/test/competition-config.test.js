const test = require("node:test"), assert = require("node:assert/strict");
const config = require("../competitionConfig");
test("managed competition rejects normalized impossible dates and retains terminal historical terms", () => {
  const row = { ...config.template("ranked"), status: "scheduled", startsAt: "2032-02-30T00:00:00.000Z", endsAt: "2032-03-10T00:00:00.000Z" };
  const value = { ...config.empty(), ranked: [row] };
  assert.ok(config.validate(value).errors.some(e => e.field === "startsAt"));
  row.startsAt = "2032-02-29T00:00:00.000Z";
  assert.equal(config.validate(value).valid, true);
  const archived = { ...value, ranked: [{ ...row, status: "archived", reason: "Season completed" }] };
  assert.equal(config.retainedProblem(value, archived), null);
  assert.match(config.retainedProblem(archived, value), /permanent/);
  assert.match(config.retainedProblem(value, config.empty()), /history/);
});
