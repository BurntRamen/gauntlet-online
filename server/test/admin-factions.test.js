const test = require("node:test"), assert = require("node:assert/strict");
const authored = require("../authoredContent"), catalog = require("../adminCatalog"), rules = require("../../shared/duel-rules"), effects = require("../../shared/duel-rules/effectRegistry");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = () => authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
test("new factions own campaign and role identities, support qualified cards, and reject scope or handler escalation", () => {
  const base = baseline(), snapshot = structuredClone(base);
  const faction = catalog.createObject(snapshot, { domain: "factions", name: "Glass dynasty", family: "rumin" });
  let validation = authored.validateAuthoredContent(snapshot, base); assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  const copy = catalog.createObject(snapshot, { domain: "factions", name: "Glass dynasty variant", sourceId: faction.id });
  assert.notEqual(copy.id, faction.id); assert.notEqual(copy.mechanics, faction.mechanics);
  const encounter = snapshot.domains.encounters.find(e => e.factionId === faction.id);
  assert.equal(encounter.setup.playerAdditions.length, 0); assert.equal(encounter.setup.bossAdditions.length, 0);
  assert.equal(snapshot.domains.characters.filter(c => c.factionId === faction.id && c.kind === "faction-role").length, 3);
  const studio = require("../mechanicAuthoring"), contract = require("../../shared/duel-rules/mechanicContract");
  snapshot.studio = { ...studio.empty(), mechanics: [studio.create()] };
  const mechanic = snapshot.studio.mechanics[0]; mechanic.cardTypes = ["servitor"]; mechanic.abilities = [contract.ability("attack")];
  const set = catalog.createObject(snapshot, { domain: "sets", name: "Glass cards" });
  const card = catalog.createObject(snapshot, { domain: "cards", name: "Glass guard", factionId: faction.id, effectId: mechanic.id, setId: set.id, type: "servitor" });
  assert.equal(card.availability.constructed, false); encounter.setup.playerAdditions.push(card.id);
  validation = authored.validateAuthoredContent(snapshot, base); assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  const resolved = authored.resolveEngineContent(snapshot, "faction-draft"); assert.equal(resolved.manifest.campaigns[faction.id].chapters[0].id, encounter.id);
  assert.equal(resolved.factions[faction.id].commander.announcements, undefined, "another faction's spoken lore is not inherited");
  assert.equal(effects.factionMechanicId({ faction: resolved.factions[faction.id] }), "rumin");
  for (const patch of [{ family: "unreviewed" }, { campaignOnly: false }, { script: "eval()" }, { mechanics: { id: "scripted", version: 1, parameters: {} } }]) {
    const invalid = structuredClone(snapshot); Object.assign(invalid.domains.factions.find(f => f.id === faction.id), patch);
    assert.equal(authored.validateAuthoredContent(invalid, base).valid, false);
  }
  for (const channel of ["constructed", "earnedPacks", "draft", "sealed"]) {
    const invalid = structuredClone(snapshot); invalid.domains.cards.at(-1).availability[channel] = true;
    assert.equal(authored.validateAuthoredContent(invalid, base).valid, false);
  }
  assert.throws(() => catalog.createObject(snapshot, { domain: "factions", name: "Unqualified", family: "undefined-family" }), /qualified/);
  assert.match(catalog.rollbackProblem(snapshot, base), /identit/);
  faction.status = "archived"; const archived = authored.resolveEngineContent(snapshot, "faction-retired");
  assert.equal(archived.manifest.campaigns[faction.id], undefined); assert.ok(archived.factions[faction.id]);
});

test("captured faction families use normal fourth-attack bonuses and third-attack payment through recovery and revision", () => {
  const base = baseline(), snapshot = structuredClone(base), faction = catalog.createObject(snapshot, { domain: "factions", name: "Rhythm variant", family: "rumin" });
  faction.mechanics.parameters.fourthAttackBonus = 6;
  const resolved = authored.resolveEngineContent(snapshot, "faction-one");
  const state = rules.createMatch({ seed: "faction-family", startingPriority: 1, gameMode: "factions", factions: { 1: resolved.factions[faction.id], 2: resolved.factions.sheen } }).state;
  const card = (id, value) => ({ id, value, rank: String(value), suit: "spades", name: id });
  state.players[1].hand = [card("attack", 3), card("pay", 9)]; state.players[1].turnData.attacksDeclaredThisTurn = 3;
  const attack = s => rules.applyCommand(s, { type: "declareHandAttack", player: 1, cardId: "attack", paymentCardIds: ["pay"] });
  const result = attack(state); assert.equal(result.accepted, true, result.rejectionReason); assert.equal(result.state.handAttacks[0].effectiveValue, 9);
  const ordinary = rules.createMatch({ gameMode: "factions", factions: { 1: resolved.factions[faction.id], 2: resolved.factions.sheen } }).state;
  authored.pinGameContent(ordinary, resolved);
  assert.equal(ordinary.players[1].hand[0].presentation.composed, true); assert.equal(ordinary.players[1].hand[0].presentation.illustration, resolved.factions[faction.id].cardImage, "faction artwork is consumed by actual ordinary-card rendering");
  const original = JSON.stringify(state); faction.mechanics.parameters.fourthAttackBonus = 1;
  assert.equal(attack(JSON.parse(original)).state.handAttacks[0].effectiveValue, 9);
  const future = structuredClone(state); future.players[1].faction = authored.resolveEngineContent(snapshot, "faction-two").factions[faction.id];
  assert.equal(attack(future).state.handAttacks[0].effectiveValue, 4);
  const third = structuredClone(state); third.players[1].turnData.attacksDeclaredThisTurn = 2; third.players[1].turnData.ruminFreeThirdReady = true;
  const free = rules.applyCommand(third, { type: "declareHandAttack", player: 1, cardId: "attack", paymentCardIds: [], useMeerusFreeAttack: true });
  assert.equal(free.accepted, true, free.rejectionReason); assert.equal(free.state.handAttacks[0].payment.required, 0);
  for (const binding of [{ id: "rumin", version: 3 }, { id: "bizi", version: 1 }, { id: "rumin", version: 1, script: "run" }]) {
    const invalid = structuredClone(state.players[1]); invalid.faction.mechanicFamily = binding; assert.equal(effects.factionMechanicId(invalid), "basic");
  }
});

test("all shipped family bindings preserve their real default roles, legal choices, costs and engine outcomes",()=>{
  const base=baseline(),snapshot=structuredClone(base),families=require("../adminFactions").FAMILIES;
  const created=families.map(family=>catalog.createObject(snapshot,{domain:"factions",name:`${family} isolated variant`,family}));
  const validation=authored.validateAuthoredContent(snapshot,base);assert.equal(validation.valid,true,JSON.stringify(validation.errors));
  const resolved=authored.resolveEngineContent(snapshot,"family-qualification");let accepted=0;
  for(const row of created){
    const source=resolved.factions[row.family],variant=resolved.factions[row.id];
    assert.equal(effects.factionMechanicId({faction:variant}),row.family);
    assert.equal(variant.general.id,source.general.id,"default general identity is a rule, not display text");
    assert.equal(variant.commander.announcements,undefined);assert.equal(variant.general.clickedAudio,undefined);
    const initial=rules.createMatch({seed:"families",startingPriority:1,gameMode:"factions",factions:{1:source,2:resolved.factions.rumin}}).state;
    const card=(id,value,suit="spades")=>({id,value,rank:String(value),suit,name:id});
    initial.players[1].hand=[card("attack",4),card("pay",14,"diamonds"),card("small",2,"hearts"),card("other",7,"clubs")];
    initial.players[1].discard=[card("old-a",3),card("old-b",4,"diamonds"),card("old-c",5,"clubs")];
    initial.players[1].accelerationCounters=5;initial.players[1].revenants=3;
    initial.players[1].turnData.attacksDeclaredThisTurn=3;
    initial.lanes.forEach((lane,i)=>{lane.facedown[1]=card(`formation-${i}`,i+3,["spades","diamonds","hearts"][i]);});
    const captured=structuredClone(initial);captured.players[1].faction={...structuredClone(variant)};
    const canonical=state=>{const copy=structuredClone(state);copy.players[1].faction=null;return JSON.parse(JSON.stringify(copy).replaceAll(row.id,row.family).replaceAll(row.name,source.name));};
    const expectedActions=rules.getLegalActions(initial,1),actualActions=rules.getLegalActions(captured,1);
    assert.deepEqual(actualActions,expectedActions,row.family);
    const commands=[{type:"declareHandAttack",player:1,cardId:"attack",paymentCardIds:["pay"]},...expectedActions.filter(a=>a.type==="useFactionAbility").map(a=>({...a,player:1,paymentCardIds:[]}))];
    for(const command of commands){const expected=rules.applyCommand(initial,command),actual=rules.applyCommand(JSON.parse(JSON.stringify(captured)),command);assert.equal(actual.accepted,expected.accepted,row.family);assert.equal(actual.rejectionReason,expected.rejectionReason,row.family);if(actual.accepted){accepted++;assert.deepEqual(canonical(actual.state),canonical(expected.state),`${row.family}: ${command.abilityId||command.type}`);}}
  }
  assert.ok(accepted>=families.length,"each family executes real commands through its captured binding");
});
