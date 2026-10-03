"use strict";

const { hash, clone, fieldsFor } = require("./authoredContent");
const { objectLabel } = require("./adminContentRelationships");
const { assetEntry } = require("./contentAssets");
const labels = { bossLife: "Boss life", attacksPerTurn: "Attacks per turn", minAttackValue: "Minimum attack value", maxAttackValue: "Maximum attack value",
  chapterNumber: "Attack progression offset", bossAbility: "Boss ability", healAtTurnStart: "Turn-start healing", evenBonus: "Even attack bonus", tier: "Ability tier",
  playerAdditions: "Player card additions", bossAdditions: "Opponent card additions", armBonus: "Armed attack bonus", fourthAttackBonus: "Fourth attack bonus", largeAttackBonus: "Large attack bonus", id: "Selected rule", version: "Contract version" };
const categories = ["Story", "Presentation", "Mechanics", "Game configuration"];
const categoryOf = (domain, field, spec) => domain === "game" && field === "handSize" ? "Game configuration" : spec.mechanical ? "Mechanics"
  : ["asset", "assets"].includes(spec.type) || ["cards", "assets", "factions", "characters"].includes(domain) ? "Presentation" : "Story";
const equal = (a, b) => hash(a ?? null) === hash(b ?? null);

function compareSnapshots(live, draft) {
  const groups = new Map(categories.map(category => [category, { id: category.toLowerCase().replace(/ /g, "-"), label: category, category, changes: [] }]));
  for (const [domain, rows] of Object.entries(draft.domains)) for (const row of rows) {
    const original = live.domains[domain]?.find(entry => entry.id === row.id);
    if (!original) continue; // Public authored schemas never allow additions/removals.
    for (const [field, spec] of Object.entries(fieldsFor(domain, original))) {
      const visit = (before, after, parts) => {
        if (equal(before, after)) return;
        if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
          for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) visit(before[key], after[key], [...parts, key]);
          return;
        }
        const child = parts.at(-1), path = parts.join("."), fieldLabel = parts.length === 1 ? spec.label : labels[child] || child;
        const display = (value, snapshot) => {
          if (["playerAdditions", "bossAdditions"].includes(child) && Array.isArray(value)) return value.map(id => snapshot.domains.cards.find(card => card.id === id)?.name || id);
          if (spec.type === "asset" || spec.type === "assets") {
            const name = value => assetEntry(value)?.source.split("/").pop() || value;
            return Array.isArray(value) ? value.map(name) : name(value);
          }
          return value ?? null;
        };
        groups.get(categoryOf(domain, field, spec)).changes.push({ domain, id: row.id, label: objectLabel(row), field, path, fieldLabel,
          live: clone(before ?? null), draft: clone(after ?? null), before: display(before, live), after: display(after, draft), mechanical: !!spec.mechanical,
          ...(spec.type === "asset" ? { media: spec.media, liveAsset: assetEntry(before), draftAsset: assetEntry(after) } : {}) });
      };
      visit(original[field], row[field], [field]);
    }
  }
  return [...groups.values()].filter(group => group.changes.length);
}

function releaseReview(status, targetRelease = null) {
  const draft = targetRelease?.snapshot || status.draft?.snapshot;
  const contentHash = draft ? hash(draft) : null;
  const groups = draft ? compareSnapshots(status.live, draft) : [];
  const engineTestRequired = groups.some(group => group.changes.some(change => change.mechanical));
  const saved = !!draft && groups.length > 0;
  const validated = !!status.validation?.valid;
  const previewed = !!contentHash && status.draft?.previewedHash === contentHash;
  const engineTested = !!contentHash && status.draft?.playtestedHash === contentHash;
  const ready = !targetRelease && saved && validated && previewed && (!engineTestRequired || engineTested) && !!status.writable && !status.pending;
  return { version: 1, revision: status.revision, hash: contentHash, groups,
    readiness: { saved, validated, previewed, engineTestRequired, engineTested, ready,
      phase: status.pending?.phase || (ready ? "ready" : status.draft ? "draft" : "live"),
      engineTestLabel: "Accepted engine action recorded", writable: !!status.writable, connectionRequired: !!status.connectionRequired },
    ...(targetRelease ? { comparison: { releaseId: targetRelease.id, label: targetRelease.label, compatible: !!targetRelease.compatible,
      activeReleaseId: status.activeReleaseId, canRollback: !!targetRelease.compatible && !status.draft && !!status.writable && !status.pending && targetRelease.id !== status.activeReleaseId } } : {}) };
}

module.exports = { compareSnapshots, releaseReview };
