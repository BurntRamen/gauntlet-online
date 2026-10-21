"use strict";
const { exact } = require("./mechanicContract");
const VERSION = "gauntlet.rule-modifiers.v1";
const fields = { playerLife: { label: "Player starting life", min: 1, max: 100 }, opponentLife: { label: "Opponent starting life", min: 1, max: 100 }, handSize: { label: "Starting and refill hand size", min: 3, max: 12 } };
function errors(row) {
  if (!exact(row, ["id", "name", "status", "interpreter", ...Object.keys(fields)]) || !/^modifier-[a-f0-9-]{36}$/.test(row.id) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 120 || /[\x00-\x1f]/.test(row.name) || !["active", "archived"].includes(row.status) || row.interpreter !== 1) return ["Use the supported modifier identity and interpreter."];
  return Object.entries(fields).flatMap(([key, spec]) => Number.isInteger(row[key]) && row[key] >= spec.min && row[key] <= spec.max ? [] : [`${spec.label} must be from ${spec.min} to ${spec.max}.`]);
}
function explain(row) { return errors(row).length ? "Correct the modifier fields." : `Campaign or isolated test only: player ${row.playerLife} life, opponent ${row.opponentLife} life; start and refill to ${row.handSize} cards. These values override the encounter's starting life and the release hand size. Payment, priority, deck slots and competitive rules stay unchanged.`; }
function apply(game, captured, scope) {
  if (!captured) return game;
  if (!["campaign", "test"].includes(scope) || !exact(captured, ["definition", "revision"]) || !/^[a-f0-9]{64}$/.test(captured.revision) || errors(captured.definition).length || game.ruleModifier || game.turn !== 1 || Number(game.revision || 0) !== 0 || Object.keys(game.players).length !== 2 || Object.values(game.players).some(p => p.hand.length)) throw new Error("Apply a supported campaign/test modifier once, before the opening draw.");
  game.ruleModifier = { ...JSON.parse(JSON.stringify(captured)), interpreter: VERSION, scope };
  game.config = { ...(game.config || { version: 1, startingLife: 42 }), handSize: captured.definition.handSize };
  game.players[1].life = captured.definition.playerLife; game.players[2].life = captured.definition.opponentLife;
  return game;
}
module.exports = { VERSION, fields, errors, explain, apply };
