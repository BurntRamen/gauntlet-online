const crypto = require("crypto");

function safeEntryCredits(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function createEventDefinitions(options = {}) {
  const entryCredits = safeEntryCredits(options.entryCredits);
  return [
    {
      id: "open-gauntlet",
      name: "Open Gauntlet",
      description: "Bring a faction deck and play until seven wins or three losses.",
      format: "factions",
      maxWins: 7,
      maxLosses: 3,
      entryCost: { currency: "boosterCredits", amount: entryCredits },
      rewardTiers: [
        { wins: 1, boosterCredits: 1 },
        { wins: 3, boosterCredits: 1, cardStyleId: "rumin-vault-shield-bearer:collector-foil" },
        { wins: 5, boosterCredits: 2 },
        { wins: 7, boosterCredits: 3, cardStyleId: "bizi-gearplate-shield:collector-foil" }
      ]
    },
    {
      id: "classic-trial",
      name: "Classic Trial",
      description: "Play the original 52-card game until five wins or two losses.",
      format: "basic",
      maxWins: 5,
      maxLosses: 2,
      entryCost: { currency: "boosterCredits", amount: entryCredits },
      rewardTiers: [
        { wins: 1, boosterCredits: 1 },
        { wins: 3, boosterCredits: 2 },
        { wins: 5, boosterCredits: 3, cardStyleId: "frumo-coral-hull-guard:collector-foil" }
      ]
    }
  ];
}

const EVENT_DEFINITIONS = createEventDefinitions({ entryCredits: process.env.GAUNTLET_EVENT_ENTRY_CREDITS || 0 });

function eventById(eventId) {
  return EVENT_DEFINITIONS.find((event) => event.id === eventId) || null;
}

function normalizeRun(run, eventId) {
  if (!run || typeof run !== "object" || run.eventId !== eventId) return null;
  const status = ["active", "complete", "resigned"].includes(run.status) ? run.status : "active";
  return {
    id: String(run.id || ""),
    eventId,
    status,
    wins: Math.max(0, Number(run.wins || 0)),
    losses: Math.max(0, Number(run.losses || 0)),
    claimedTiers: [...new Set((run.claimedTiers || []).map(Number).filter(Number.isFinite))],
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null
  };
}

function normalizeEventProgress(stats = {}) {
  const source = stats.events && typeof stats.events === "object" ? stats.events : {};
  const runs = {};
  for (const event of EVENT_DEFINITIONS) {
    const run = normalizeRun(source.runs?.[event.id], event.id);
    if (run) runs[event.id] = run;
  }
  return {
    schemaVersion: 1,
    runs,
    entries: Math.max(0, Number(source.entries || 0)),
    totalWins: Math.max(0, Number(source.totalWins || 0)),
    history: Array.isArray(source.history) ? source.history.slice(0, 20) : []
  };
}

function startEventRun(stats, eventId, options = {}) {
  const event = eventById(eventId);
  if (!event) throw new Error("Unknown event.");
  const progress = normalizeEventProgress(stats);
  const current = progress.runs[eventId];
  if (current?.status === "active") return { progress, run: current, created: false, event };
  const now = options.now || new Date().toISOString();
  const run = {
    id: options.runId || crypto.randomUUID(),
    eventId,
    status: "active",
    wins: 0,
    losses: 0,
    claimedTiers: [],
    startedAt: now,
    completedAt: null
  };
  progress.runs[eventId] = run;
  progress.entries += 1;
  return { progress, run, created: true, event };
}

function applyEventResult(stats, eventId, runId, result, options = {}) {
  const event = eventById(eventId);
  if (!event) throw new Error("Unknown event.");
  const progress = normalizeEventProgress(stats);
  const run = progress.runs[eventId];
  if (!run || run.id !== runId || run.status !== "active") return { progress, run, rewards: [] };
  if (result === "draw") return { progress, run, rewards: [] };
  if (result === "win") {
    run.wins += 1;
    progress.totalWins += 1;
  } else if (result === "loss") {
    run.losses += 1;
  } else {
    return { progress, run, rewards: [] };
  }
  const rewards = event.rewardTiers.filter((tier) => run.wins >= tier.wins && !run.claimedTiers.includes(tier.wins));
  run.claimedTiers.push(...rewards.map((tier) => tier.wins));
  if (run.wins >= event.maxWins || run.losses >= event.maxLosses) {
    run.status = "complete";
    run.completedAt = options.now || new Date().toISOString();
    progress.history.unshift({ ...run });
    progress.history = progress.history.slice(0, 20);
  }
  return { progress, run, rewards };
}

function resignEventRun(stats, eventId, options = {}) {
  const progress = normalizeEventProgress(stats);
  const run = progress.runs[eventId];
  if (!run || run.status !== "active") throw new Error("There is no active run to resign.");
  run.status = "resigned";
  run.completedAt = options.now || new Date().toISOString();
  progress.history.unshift({ ...run });
  progress.history = progress.history.slice(0, 20);
  return { progress, run };
}

module.exports = {
  EVENT_DEFINITIONS,
  applyEventResult,
  createEventDefinitions,
  eventById,
  normalizeEventProgress,
  resignEventRun,
  startEventRun
};
