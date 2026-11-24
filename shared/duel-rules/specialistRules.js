"use strict";

const defaults = require("./specialistOperands.json");
const flags = new Set(["countsAsLaneSwap", "countsAsSacrifice", "discardAfterUse"]);
const parametersFor = id => Object.hasOwn(defaults, id) ? defaults[id] : null;
function bounds(operation) {
  return {min: operation === "peekDepth" ? 1 : 0, max: flags.has(operation) ? 1 : 8};
}
function inRange(operation, amount) {
  const { min, max } = bounds(operation);
  return Number.isSafeInteger(amount) && amount >= min && amount <= max;
}
function validParameters(id, parameters) {
  const spec = parametersFor(id);
  return !!spec && !!parameters && !Array.isArray(parameters) && typeof parameters === "object"
    && Object.keys(parameters).length === Object.keys(spec).length
    && Object.keys(spec).every(key => Object.hasOwn(parameters, key) && inRange(key, parameters[key]));
}
function decompile(effect, definition) {
  const spec = parametersFor(effect.id);
  if (!spec) return null;
  const parameters = effect.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return null;
  if (!validParameters(effect.id, parameters) && (Object.keys(parameters).length !== Object.keys(definition.parameters).length
      || !Object.keys(definition.parameters).every(key => Object.hasOwn(parameters, key) && inRange(key, parameters[key])))) return null;
  return { id: effect.id, version: effect.version, modules: Object.entries(spec).map(([operation, amount]) =>
    ({ operation, amount: parameters[operation] ?? amount })) };
}
function compile(effect, definition) {
  const spec = parametersFor(effect.id);
  if (!spec || effect.version !== definition.version || !Array.isArray(effect.modules)
      || effect.modules.length !== Object.keys(spec).length) return null;
  const parameters = {};
  for (const module of effect.modules) {
    if (!module || typeof module !== "object" || Object.keys(module).length !== 2
        || !Object.hasOwn(module, "operation") || !Object.hasOwn(module, "amount")
        || typeof module.operation !== "string" || !Object.hasOwn(spec, module.operation)
        || Object.hasOwn(parameters, module.operation) || !inRange(module.operation, module.amount)) return null;
    parameters[module.operation] = module.amount;
  }
  // Preserve existing captures whenever all newly exposed operands retain their printed values.
  const originalKeys = Object.keys(definition.parameters);
  const legacy = Object.keys(spec).every(key => originalKeys.includes(key) || parameters[key] === spec[key]);
  return {id:effect.id, version:effect.version, parameters: legacy
    ? Object.fromEntries(originalKeys.map(key => [key, parameters[key]])) : parameters};
}
module.exports = { parametersFor, bounds, validParameters, decompile, compile };
