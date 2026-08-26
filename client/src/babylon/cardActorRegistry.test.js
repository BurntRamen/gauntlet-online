import { CardActorRegistry } from "./cardActorRegistry";

function snapshot(actors) {
  return { actors };
}

function actor(actorId, zone = "hand") {
  return { actorId, anonymous: actorId.startsWith("hidden:"), zone: { kind: zone } };
}

test("registry preserves runtime identity while an actor changes role", () => {
  const created = [];
  const updated = [];
  const registry = new CardActorRegistry({
    create: (entry) => {
      const runtime = { token: entry.actorId };
      created.push(runtime);
      return runtime;
    },
    update: (runtime) => updated.push(runtime)
  });
  registry.reconcile(snapshot([actor("card:one", "hand")]));
  registry.reconcile(snapshot([actor("card:one", "combat")]));
  expect(created).toHaveLength(1);
  expect(updated).toEqual([created[0]]);
});

test("registry can retain an animated departure until completion", () => {
  const disposed = [];
  const registry = new CardActorRegistry({
    create: (entry) => ({ id: entry.actorId }),
    depart: () => true,
    dispose: (runtime) => disposed.push(runtime.id)
  });
  registry.reconcile(snapshot([actor("card:one")]));
  registry.reconcile(snapshot([]), [{ actorId: "card:one", animate: true }]);
  expect(registry.metrics().departingActorCount).toBe(1);
  registry.completeDeparture("card:one");
  expect(disposed).toEqual(["card:one"]);
  expect(registry.metrics().cardActorCount).toBe(0);
});

test("registry marks departures before creating actors that enter the vacated zone", () => {
  const calls = [];
  const registry = new CardActorRegistry({
    create: (entry) => {
      calls.push(`create:${entry.actorId}`);
      return { id: entry.actorId };
    },
    depart: (_runtime, entry) => {
      calls.push(`depart:${entry.actorId}`);
      return true;
    }
  });

  registry.reconcile(snapshot([actor("card:outgoing", "payment")]));
  calls.length = 0;
  registry.reconcile(snapshot([actor("card:incoming", "payment")]), [
    { actorId: "card:outgoing", animate: true },
    { actorId: "card:incoming", animate: true }
  ]);

  expect(calls).toEqual(["depart:card:outgoing", "create:card:incoming"]);
  expect(registry.get("card:outgoing")?.departing).toBe(true);
  expect(registry.get("card:incoming")?.departing).toBe(false);
});

test("registry reflows seated actors before planning a new zone entrant", () => {
  const calls = [];
  const registry = new CardActorRegistry({
    create: (entry) => {
      calls.push(`create:${entry.actorId}`);
      return { id: entry.actorId };
    },
    update: (_runtime, entry) => calls.push(`update:${entry.actorId}`)
  });

  registry.reconcile(snapshot([actor("card:z-seated", "payment")]));
  calls.length = 0;
  registry.reconcile(snapshot([
    actor("card:a-incoming", "payment"),
    actor("card:z-seated", "payment")
  ]));

  expect(calls).toEqual(["update:card:z-seated", "create:card:a-incoming"]);
});

test("registry uses semantic priority buckets instead of actor identifiers for motion planning", () => {
  const calls = [];
  const motionPriority = (_entry, transition) => (
    transition?.motionRole === "payment-enter"
      ? 0
      : ["attack-enter", "block-enter"].includes(transition?.motionRole)
        ? 2
        : 1
  );
  const registry = new CardActorRegistry({
    order: motionPriority,
    create: (entry) => {
      calls.push(`create:${entry.actorId}`);
      return { id: entry.actorId };
    },
    update: (_runtime, entry) => calls.push(`update:${entry.actorId}`)
  });

  registry.reconcile(snapshot([actor("card:z-attacker", "hand")]));
  calls.length = 0;
  registry.reconcile(snapshot([
    actor("card:a-blocker", "combat"),
    actor("card:z-attacker", "combat"),
    actor("card:m-payment", "payment")
  ]), [
    { actorId: "card:a-blocker", motionRole: "block-enter", animate: true },
    { actorId: "card:z-attacker", motionRole: "attack-enter", animate: true },
    { actorId: "card:m-payment", motionRole: "payment-enter", animate: true }
  ]);

  expect(calls).toEqual([
    "create:card:m-payment",
    "update:card:z-attacker",
    "create:card:a-blocker"
  ]);
});

test("registry rekeys a hidden reveal without replacing its runtime", () => {
  const created = [];
  const updated = [];
  const registry = new CardActorRegistry({
    create: (entry) => {
      const runtime = { token: entry.actorId };
      created.push(runtime);
      return runtime;
    },
    update: (runtime, entry) => updated.push({ runtime, actorId: entry.actorId })
  });
  registry.reconcile(snapshot([actor("hidden:player-2:lane:0", "lane")]));
  registry.reconcile(snapshot([actor("card:revealed", "combat")]), [{
    actorId: "card:revealed",
    rebindFromActorId: "hidden:player-2:lane:0",
    animate: true
  }]);
  expect(created).toHaveLength(1);
  expect(updated).toEqual([{ runtime: created[0], actorId: "card:revealed" }]);
  expect(registry.get("hidden:player-2:lane:0")).toBeNull();
  expect(registry.get("card:revealed")?.runtime).toBe(created[0]);
});

test("equivalent revisions preserve the mesh, contact shadow, and texture runtime", () => {
  const created = [];
  const registry = new CardActorRegistry({
    create: (entry) => {
      const runtime = {
        mesh: { id: `mesh:${entry.actorId}` },
        contactShadow: { id: `shadow:${entry.actorId}` },
        texture: { id: `texture:${entry.actorId}` }
      };
      created.push(runtime);
      return runtime;
    }
  });
  const same = actor("card:stable", "hand");
  registry.reconcile(snapshot([same]));
  registry.reconcile(snapshot([{ ...same, selected: true }]));
  registry.reconcile(snapshot([{ ...same, label: "Updated label" }]));

  expect(created).toHaveLength(1);
  expect(registry.get("card:stable").runtime).toBe(created[0]);
});

test("runtime diagnostics detect duplicate visible identities even under different actor keys", () => {
  const registry = new CardActorRegistry({ create: (entry) => ({ id: entry.actorId }) });
  registry.reconcile(snapshot([
    { ...actor("legacy:hand", "hand"), visibleIdentity: "card:one" },
    { ...actor("legacy:combat", "combat"), visibleIdentity: "card:one" }
  ]));

  expect(registry.metrics().duplicateVisibleIdentityCount).toBe(1);
  expect(registry.duplicateVisibleIdentities()[0]).toEqual(expect.objectContaining({
    identity: "card:one",
    entries: expect.arrayContaining([
      expect.objectContaining({ actorId: "legacy:hand" }),
      expect.objectContaining({ actorId: "legacy:combat" })
    ])
  }));
});
