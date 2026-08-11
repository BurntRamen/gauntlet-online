export const CARD_ACTOR_REGISTRY_VERSION = "gauntlet.card-actor-registry.v1";

export class CardActorRegistry {
  constructor({ create, update, depart, dispose } = {}) {
    this.callbacks = { create, update, depart, dispose };
    this.records = new Map();
  }

  reconcile(snapshot, transitions = []) {
    const transitionByActor = new Map(transitions.map((transition) => [transition.actorId, transition]));
    const nextIds = new Set();
    transitions.forEach((transition) => {
      if (!transition.rebindFromActorId || transition.rebindFromActorId === transition.actorId) return;
      if (this.records.has(transition.actorId)) return;
      const existing = this.records.get(transition.rebindFromActorId);
      if (!existing) return;
      this.records.delete(transition.rebindFromActorId);
      this.records.set(transition.actorId, existing);
    });
    (snapshot?.actors || []).forEach((actor) => nextIds.add(actor.actorId));

    // Mark physical departures before planning incoming actors. The renderer
    // can then reserve an orderly handoff instead of treating a tray/combat
    // slot that is already vacating as a permanent obstacle.
    for (const [actorId, record] of this.records.entries()) {
      if (nextIds.has(actorId) || record.departing) continue;
      const transition = transitionByActor.get(actorId) || null;
      if (transition?.animate && this.callbacks.depart?.(record.runtime, record.actor, transition) !== false) {
        record.departing = true;
        continue;
      }
      this.callbacks.dispose?.(record.runtime, record.actor);
      this.records.delete(actorId);
    }

    const incomingActors = [];
    (snapshot?.actors || []).forEach((actor) => {
      const transition = transitionByActor.get(actor.actorId) || null;
      const existing = this.records.get(actor.actorId);
      if (existing) {
        existing.actor = actor;
        existing.departing = false;
        this.callbacks.update?.(existing.runtime, actor, transition);
        return;
      }
      incomingActors.push({ actor, transition });
    });
    // Reflow actors already seated in a multi-card zone before an incoming
    // actor plans its route. That makes the newly assigned slot physically
    // available and avoids routing around a stale center target.
    incomingActors.forEach(({ actor, transition }) => {
      const runtime = this.callbacks.create?.(actor, transition);
      this.records.set(actor.actorId, { actor, runtime, departing: false });
    });
  }

  completeDeparture(actorId) {
    const record = this.records.get(actorId);
    if (!record) return;
    this.callbacks.dispose?.(record.runtime, record.actor);
    this.records.delete(actorId);
  }

  clear() {
    for (const record of this.records.values()) this.callbacks.dispose?.(record.runtime, record.actor);
    this.records.clear();
  }

  get(actorId) {
    return this.records.get(actorId) || null;
  }

  duplicateVisibleIdentities() {
    const byIdentity = new Map();
    this.records.forEach((record, actorId) => {
      const identity = record.actor?.visibleIdentity || actorId;
      const entries = byIdentity.get(identity) || [];
      entries.push({ actorId, actor: record.actor, departing: record.departing });
      byIdentity.set(identity, entries);
    });
    return Array.from(byIdentity.entries())
      .filter(([, entries]) => entries.length > 1)
      .map(([identity, entries]) => ({ identity, entries }));
  }

  metrics() {
    const byZone = {};
    let anonymousActorCount = 0;
    let departing = 0;
    this.records.forEach((record) => {
      const zone = record.actor?.zone?.kind || "unknown";
      byZone[zone] = (byZone[zone] || 0) + 1;
      if (record.actor?.anonymous) anonymousActorCount += 1;
      if (record.departing) departing += 1;
    });
    return {
      registryVersion: CARD_ACTOR_REGISTRY_VERSION,
      cardActorCount: this.records.size,
      actorsByZone: byZone,
      anonymousActorCount,
      knownActorCount: this.records.size - anonymousActorCount,
      departingActorCount: departing,
      duplicateVisibleIdentityCount: this.duplicateVisibleIdentities().length
    };
  }
}
