"use strict";

const isMekan = (player) => player?.faction?.id === "mekan";
const general = (player) => player?.faction?.general?.id || player?.faction?.generalId || "monti";
const value = (card) => ({ A: 14, K: 13, Q: 12, J: 11 }[card?.rank] || Number(card?.value) || 0);
const label = (card) => `${card.rank || card.value}${card.suit}`;
const guests = (player) => player.discard.filter((card) => card.mekanGuest);

function paid(player, cards) {
  if (!isMekan(player)) return;
  player.turnData.mekanPaid = [...(player.turnData.mekanPaid || []), ...cards.map((card) => card.id)];
  player.turnData.mekanDiscards = (player.turnData.mekanDiscards || 0) + cards.length;
}

function playBonus(player, card, paymentIds = []) {
  const notes = [];
  if (!isMekan(player)) return { bonus: 0, notes };
  const turn = player.turnData;
  if (!turn.mekanCelebrate && guests(player).some((guest) => value(guest) === value(card) || guest.suit === card.suit)) {
    turn.mekanCelebrate = true;
    notes.push("Celebrate +1");
  }
  const invited = guests(player).find((guest) => guest.id === turn.mekanInvitation && value(guest) === value(card));
  if (invited) {
    player.discard = player.discard.filter((entry) => entry.id !== invited.id);
    player.removedFromGame = [...(player.removedFromGame || []), invited];
    turn.mekanInvitation = null;
    notes.push("The Guests Return +1");
  }
  if (general(player) === "hui" && !turn.mekanHui && player.discard.some((entry) => !paymentIds.includes(entry.id) && entry.suit === card.suit)) {
    turn.mekanHui = true;
    notes.push("Invite Everyone +1");
  }
  if (general(player) === "temo" && turn.mekanTemoReady) {
    turn.mekanTemoReady = false;
    notes.push("One More Dance +1");
  }
  return { bonus: notes.length, notes };
}

function combat(game, attack, damage) {
  const defeated = damage === 0 && attack.block.length ? [{ player: attack.player, card: attack.card }] : [];
  if (damage > 0) defeated.push(...attack.block);
  for (const entry of defeated) {
    const player = game.players[entry.player];
    if (!isMekan(player)) continue;
    player.turnData.mekanDefeated = [...(player.turnData.mekanDefeated || []), entry.card.id];
    if (general(player) === "temo" && !player.turnData.mekanTemoUsed) {
      player.turnData.mekanTemoUsed = true;
      player.turnData.mekanTemoReady = true;
    }
  }
  const winner = game.players[damage > 0 ? attack.player : attack.targetPlayer];
  if (isMekan(winner) && general(winner) === "ahu" && attack.block.length) winner.turnData.mekanAhuReady = true;
}

function actions(game, number) {
  const player = game.players[number];
  if (!isMekan(player) || game.gameMode !== "factions" || game.phase !== "priority" || game.priority !== number) return [];
  const turn = player.turnData;
  const result = [];
  const add = (id, text) => result.push({ type: "useFactionAbility", abilityId: `mekan:${id}`, label: text, intent: text });
  for (const card of player.discard) {
    if (!card.mekanGuest && !turn.mekanEncore && turn.mekanPaid?.includes(card.id)) add(`encore:${card.id}`, `Encore · mark ${label(card)} as a Guest`);
    if (!card.mekanGuest && !turn.mekanCityGuest && turn.mekanDefeated?.includes(card.id)) add(`remember:${card.id}`, `San Mikal · remember ${label(card)} as a Guest`);
    if (card.mekanGuest && turn.mekanInvitation !== card.id) add(`invite:${card.id}`, `Invite Guest ${label(card)} · next matching value gets +1`);
  }
  if (turn.mekanInvitation) add("cancel-invite", "Cancel Guest invitation");
  if (general(player) === "monti" && !turn.mekanMonti && turn.mekanDiscards >= 2) {
    for (const card of [...player.hand, ...game.lanes.map((lane) => lane.facedown[number]).filter(Boolean)]) {
      add(`monti:${card.id}`, `Monti · give ${label(card)} +1 this turn`);
    }
  }
  const count = player.deckCount ?? player.deck.length;
  const acama = general(player) === "acama" && game.lanes.some((lane) => lane.facedown[number]);
  const ahu = general(player) === "ahu" && turn.mekanAhuReady;
  if ((acama || ahu) && !turn.mekanScryUsed && count > 0) {
    if (!turn.mekanLooked) add("look", acama ? "Acama · inspect the top card" : "Ahu · inspect the top two cards");
    else {
      const cards = (turn.mekanPeek || []).map(label).join(", ");
      add("keep", `${acama ? "Acama" : "Ahu"} · ${cards} · keep first on top${acama ? "" : ", second on bottom"}`);
      add("bottom", `${acama ? "Acama" : "Ahu"} · ${cards} · ${acama ? "put on bottom" : "keep second on top, first on bottom"}`);
    }
  }
  return result;
}

function apply(game, number, id, events, event) {
  if (!actions(game, number).some((action) => action.abilityId === id)) return "That Mekan ability is unavailable.";
  const player = game.players[number];
  const turn = player.turnData;
  const [, kind, ...parts] = id.split(":");
  const cardId = parts.join(":");
  if (kind === "encore" || kind === "remember") {
    player.discard.find((card) => card.id === cardId).mekanGuest = true;
    turn[kind === "encore" ? "mekanEncore" : "mekanCityGuest"] = true;
  } else if (kind === "invite") turn.mekanInvitation = cardId;
  else if (kind === "cancel-invite") turn.mekanInvitation = null;
  else if (kind === "monti") {
    const card = [...player.hand, ...game.lanes.map((lane) => lane.facedown[number]).filter(Boolean)].find((entry) => entry.id === cardId);
    card.temporaryValueBonus = Number(card.temporaryValueBonus || 0) + 1;
    card.temporaryValueBonusNotes = [...(card.temporaryValueBonusNotes || []), "Grand Celebration +1"];
    turn.mekanMonti = true;
  } else if (kind === "look") {
    turn.mekanLooked = true;
    const count = general(player) === "ahu" ? 2 : 1;
    turn.mekanPeek = player.deck.slice(-count).reverse().map((card) => ({ ...card }));
    turn.mekanPeek.forEach((card, index) => events.push(event(game, "card.peeked", {
      player: number, viewer: number, card: { ...card }, source: `Mekan deck position ${index + 1}`
    })));
  } else {
    const top = player.deck.pop();
    if (general(player) === "ahu" && player.deck.length) {
      const second = player.deck.pop();
      player.deck.push(kind === "keep" ? top : second);
      player.deck.unshift(kind === "keep" ? second : top);
    } else if (kind === "bottom") player.deck.unshift(top);
    else player.deck.push(top);
    turn.mekanScryUsed = true;
  }
  events.push(event(game, "ability.used", { player: number, abilityId: `mekan:${kind}`, source: "Mekan" }));
  return null;
}

module.exports = { paid, playBonus, combat, actions, apply };
