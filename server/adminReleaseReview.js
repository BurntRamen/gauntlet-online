"use strict";

const { hash, clone, fieldsFor, fieldValue } = require("./authoredContent");
const { objectLabel } = require("./adminContentRelationships");
const { assetEntry } = require("./contentAssets");
const labels = { bossLife: "Boss life", attacksPerTurn: "Attacks per turn", minAttackValue: "Minimum attack value", maxAttackValue: "Maximum attack value",
  chapterNumber: "Attack progression offset", bossAbility: "Boss ability", healAtTurnStart: "Turn-start healing", evenBonus: "Even attack bonus", tier: "Ability tier",
  playerAdditions: "Player card additions", bossAdditions: "Opponent card additions", armBonus: "Armed attack bonus", fourthAttackBonus: "Fourth attack bonus", largeAttackBonus: "Large attack bonus", id: "Selected rule", version: "Contract version" };
const categories = ["Story", "Presentation", "Mechanics", "Game configuration", "Store"];
const categoryOf = (domain, field, spec) => domain === "offers" ? "Store" : domain === "game" && field === "handSize" ? "Game configuration" : spec.mechanical ? "Mechanics"
  : ["asset", "assets"].includes(spec.type) || ["cards", "assets", "factions", "characters"].includes(domain) ? "Presentation" : "Story";
const equal = (a, b) => hash(a ?? null) === hash(b ?? null);

function compareSnapshots(live, draft) {
  const groups = new Map(categories.map(category => [category, { id: category.toLowerCase().replace(/ /g, "-"), label: category, category, changes: [] }]));
  for (const [domain, rows] of Object.entries(draft.domains)) for (const row of rows) {
    const original = live.domains[domain]?.find(entry => entry.id === row.id);
    for (const [field, spec] of Object.entries(fieldsFor(domain, original || row))) {
      if (field === "effect" && [original?.effect?.id, row.effect?.id].includes("composed-rumin-armament")) {
        if (!equal(original?.effect, row.effect)) {
          const describe = effect => effect?.id === "composed-rumin-armament" ? require("../shared/duel-rules/compositionExplanation").explain(effect) : effect?.id || "No previous definition";
          groups.get("Mechanics").changes.push({ domain, id: row.id, label: objectLabel(row), field, path: field, fieldLabel: "Executable abilities", live: clone(original?.effect ?? null), draft: clone(row.effect), before: describe(original?.effect), after: describe(row.effect), mechanical: true });
        }
        continue;
      }
      const visit = (before, after, parts) => {
        if (equal(before, after)) return;
        if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
          for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) visit(before[key], after[key], [...parts, key]);
          return;
        }
        const child = parts.at(-1), path = parts.join("."), fieldLabel = parts.length === 1 ? spec.label : labels[child] || child;
        const display = (value, snapshot) => {
          if (domain === "decks" && child === "cards" && Array.isArray(value)) return value.map(selection => `${snapshot.domains.cards.find(card => card.id === selection.cardId)?.name || selection.cardId} · ${snapshot.domains.assets.find(printing => printing.id === selection.printingId)?.name || selection.printingId}`);
          if (spec.type === "deck-reference") return snapshot.domains.decks.find(deck => deck.id === value)?.name || value || "Existing scripted deck";
          if (["playerAdditions", "bossAdditions"].includes(child) && Array.isArray(value)) return value.map(id => snapshot.domains.cards.find(card => card.id === id)?.name || id);
          if (spec.type === "printing-edition") return require("./adminPrintings").editions(snapshot).find(set => set.id === value)?.name || value;
          if (spec.type === "asset" || spec.type === "assets") {
            const name = value => assetEntry(value, snapshot.assetVersions)?.source?.split("/").pop() || (snapshot.assetVersions?.find(row => row.id === value) ? `Uploaded artwork · version ${snapshot.assetVersions.find(row => row.id === value).version}` : value);
            return Array.isArray(value) ? value.map(name) : name(value);
          }
          return value ?? null;
        };
        groups.get(categoryOf(domain, field, spec)).changes.push({ domain, id: row.id, label: objectLabel(row), field, path, fieldLabel,
          live: clone(before ?? null), draft: clone(after ?? null), before: display(before, live), after: display(after, draft), mechanical: !!spec.mechanical,
          ...(row.origin === "admin-printing-v1" ? { scope: "Printing presentation only. Gameplay, ownership and acquisition pools are unchanged; this printing requires explicit entitlement. Only a configured published deck product can grant it; creation does not add pack entries." } : {}),
          ...(spec.type === "asset" ? { media: spec.media, liveAsset: assetEntry(before, live.assetVersions), draftAsset: assetEntry(after, draft.assetVersions, "draft:review") } : {}) });
      };
      visit(fieldValue(original, field, spec), fieldValue(row, field, spec), [field]);
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
      activeReleaseId: status.activeReleaseId, rollbackBlocked: require("./adminCatalog").rollbackProblem(status.live, targetRelease.snapshot), canRollback: !!targetRelease.compatible && !require("./adminCatalog").rollbackProblem(status.live, targetRelease.snapshot) && !status.draft && !!status.writable && !status.pending && targetRelease.id !== status.activeReleaseId } } : {}) };
}

module.exports = { compareSnapshots, releaseReview };
