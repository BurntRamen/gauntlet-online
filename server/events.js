const crypto = require("crypto");

function safeEntryCredits(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

const MAJOR_EVENT_SCHEDULE = Object.freeze([
  {
    id: "fall-grand-gauntlet-2026",
    name: "Fall Grand Gauntlet",
    description: "The first major faction championship. Build a faction deck and chase twelve wins across one long weekend.",
    format: "factions",
    startsAt: "2026-10-23T17:00:00.000Z",
    entryClosesAt: "2026-10-26T00:00:00.000Z",
    endsAt: "2026-10-26T04:00:00.000Z",
    maxWins: 12,
    maxLosses: 3,
    rewardTiers: [
      { wins: 1, gold: 500, boosterCredits: 1 },
      { wins: 4, gold: 1000, boosterCredits: 2 },
      { wins: 8, gold: 1500, boosterCredits: 3, cardStyleId: "rumin-vault-shield-bearer:collector-foil" },
      { wins: 12, gold: 3000, boosterCredits: 5, cardStyleId: "bizi-gearplate-shield:collector-foil" }
    ]
  },
  {
    id: "classic-crown-2026",
    name: "Classic Crown",
    description: "A large original-rules tournament using the standard 52-card Gauntlet deck.",
    format: "basic",
    startsAt: "2026-11-13T17:00:00.000Z",
    entryClosesAt: "2026-11-16T00:00:00.000Z",
    endsAt: "2026-11-16T04:00:00.000Z",
    maxWins: 10,
    maxLosses: 3,
    rewardTiers: [
      { wins: 1, gold: 500, boosterCredits: 1 },
      { wins: 3, gold: 1000, boosterCredits: 2 },
      { wins: 7, gold: 1500, boosterCredits: 3 },
      { wins: 10, gold: 3000, boosterCredits: 5, cardStyleId: "frumo-coral-hull-guard:collector-foil" }
    ]
  },
  {
    id: "new-year-open-2027",
    name: "New Year Open",
    description: "All playable factions meet in the first major of 2027, with the largest free prize track yet.",
    format: "factions",
    startsAt: "2027-01-15T17:00:00.000Z",
    entryClosesAt: "2027-01-18T00:00:00.000Z",
    endsAt: "2027-01-18T04:00:00.000Z",
    maxWins: 12,
    maxLosses: 3,
    rewardTiers: [
      { wins: 1, gold: 750, boosterCredits: 1 },
      { wins: 4, gold: 1250, boosterCredits: 2 },
      { wins: 8, gold: 2000, boosterCredits: 4, cardStyleId: "frumo-coral-hull-guard:collector-foil" },
      { wins: 12, gold: 4000, boosterCredits: 6, cardStyleId: "bizi-gearplate-shield:collector-foil" }
    ]
  }
]);

function eventAvailability(event, now = new Date()) {
  if (event?.status && event.status !== "scheduled") return { state: event.status, label: ({ draft: "Not published for entry", paused: "Paused", cancelled: "Cancelled", archived: "Retired · existing runs retained" })[event.status] || "Unavailable", canEnter: false, canPlay: event.status === "archived" && eventAvailability({ ...event, status: "scheduled" }, now).canPlay, nextTransitionAt: null };
  if (!event?.schedule) return { state: "open", label: "Open now", canEnter: true, canPlay: true, nextTransitionAt: null };
  const nowMs = new Date(now).getTime();
  const startsAt = new Date(event.schedule.startsAt).getTime();
  const entryClosesAt = new Date(event.schedule.entryClosesAt).getTime();
  const endsAt = new Date(event.schedule.endsAt).getTime();
  if (nowMs < startsAt) return { state: "upcoming", label: "Upcoming", canEnter: false, canPlay: false, nextTransitionAt: event.schedule.startsAt };
  if (nowMs < entryClosesAt) return { state: "live", label: "Entry open", canEnter: true, canPlay: true, nextTransitionAt: event.schedule.entryClosesAt };
  if (nowMs < endsAt) return { state: "entry-closed", label: "Entry closed", canEnter: false, canPlay: true, nextTransitionAt: event.schedule.endsAt };
  return { state: "ended", label: "Event ended", canEnter: false, canPlay: false, nextTransitionAt: null };
}

function createEventDefinitions(options = {}) {
  const entryCredits = safeEntryCredits(options.entryCredits);
  const evergreen = [
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
  const majors = MAJOR_EVENT_SCHEDULE.map(({ startsAt, entryClosesAt, endsAt, ...event }) => ({
    ...event,
    scale: "major",
    entryCost: { currency: "boosterCredits", amount: entryCredits },
    schedule: { startsAt, entryClosesAt, endsAt }
  }));
  return [...majors, ...evergreen];
}

const EVENT_DEFINITIONS = createEventDefinitions({ entryCredits: process.env.GAUNTLET_EVENT_ENTRY_CREDITS || 0 });
let definitionProvider = () => [];
function setEventProvider(provider) { definitionProvider = provider; }
const definitions = () => [...EVENT_DEFINITIONS, ...definitionProvider()];

function eventById(eventId) {
  return definitions().find((event) => event.id === eventId) || null;
}

function listEventDefinitions(options = {}) {
  return definitions().filter(event => event.status !== "draft").map((event) => ({ ...event, availability: eventAvailability(event, options.now) }));
}

function normalizeRun(run, eventId) {
  if (!run || typeof run !== "object" || run.eventId !== eventId) return null;
  const status = ["active", "complete", "resigned"].includes(run.status) ? run.status : "active";
  return {
    id: String(run.id || ""),
    eventId,
    ...(run.definition ? { definition: structuredClone(run.definition) } : {}),
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
  for (const eventId of new Set([...definitions().map(event => event.id), ...Object.keys(source.runs || {})])) {
    const run = normalizeRun(source.runs?.[eventId], eventId);
    if (run) runs[eventId] = run;
  }
  return {
    schemaVersion: 1,
    runs,
    entries: Math.max(0, Number(source.entries || 0)),
    totalWins: Math.max(0, Number(source.totalWins || 0)),
    entryCounts: { ...(source.entryCounts || {}) },
    history: Array.isArray(source.history) ? source.history.slice(0, 20) : []
  };
}

function startEventRun(stats, eventId, options = {}) {
  const event = eventById(eventId);
  if (!event) throw new Error("Unknown event.");
  const availability = eventAvailability(event, options.now);
  if (!availability.canEnter) {
    if (availability.state === "upcoming") throw new Error("Registration for this event is not open yet.");
    if (availability.state === "entry-closed") throw new Error("Registration for this event has closed.");
    throw new Error("This event has ended.");
  }
  const progress = normalizeEventProgress(stats);
  const current = progress.runs[eventId];
  if (current?.status === "active") return { progress, run: current, created: false, event };
  if (event.attemptLimit && Number(progress.entryCounts[eventId] || 0) >= event.attemptLimit) throw new Error("This event's entry limit has been reached.");
  const now = options.now || new Date().toISOString();
  const run = {
    id: options.runId || crypto.randomUUID(),
    eventId,
    definition: structuredClone(event),
    status: "active",
    wins: 0,
    losses: 0,
    claimedTiers: [],
    startedAt: now,
    completedAt: null
  };
  progress.runs[eventId] = run;
  progress.entries += 1;
  progress.entryCounts[eventId] = Number(progress.entryCounts[eventId] || 0) + 1;
  return { progress, run, created: true, event };
}

function applyEventResult(stats, eventId, runId, result, options = {}) {
  const progress = normalizeEventProgress(stats);
  const run = progress.runs[eventId];
  const event = run?.definition || eventById(eventId);
  if (!event) throw new Error("Unknown event.");
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
  setEventProvider,
  EVENT_DEFINITIONS,
  MAJOR_EVENT_SCHEDULE,
  applyEventResult,
  createEventDefinitions,
  eventAvailability,
  eventById,
  listEventDefinitions,
  normalizeEventProgress,
  resignEventRun,
  startEventRun
};
