"use strict";

const isIndela = (player) => player?.faction?.id === "indela";
const general = (player) => player?.faction?.general?.id;
const cardValue = (card) => {
  if (card?.rank === "A" || card?.value === "A") return 14;
  if (card?.rank === "K" || card?.value === "K") return 13;
  if (card?.rank === "Q" || card?.value === "Q") return 12;
  if (card?.rank === "J" || card?.value === "J") return 11;
  return Number(card?.value) || 0;
};

function revealOmens(game, playerNumber, events, event) {
  const player = game?.players?.[playerNumber];
  if (!isIndela(player) || !player.deck.length) return;
  const triggers = general(player) === "ramar" ? 2 : 1;
  const card = player.deck[player.deck.length - 1];
  const value = cardValue(card);
  const parity = value % 2 === 0 ? "even" : "odd";
  player.turnData.indelaRevealedValues = Array(triggers).fill(value);
  player.turnData.indelaOwnReduction = parity === "odd" ? triggers : 0;
  player.turnData.indelaOpponentTax = parity === "even" ? triggers : 0;
  events.push(event(game, "indela.omenRevealed", {
    player: Number(playerNumber), card: { ...card }, value, parity, triggers,
    sources: triggers === 2 ? ["Katel", "Ramar"] : ["Katel"]
  }));
}

function paymentAdjustment(game, playerNumber) {
  const player = game?.players?.[playerNumber];
  const opponent = game?.players?.[Number(playerNumber) === 1 ? 2 : 1];
  const reduction = isIndela(player) ? Number(player.turnData.indelaOwnReduction || 0) : 0;
  const tax = isIndela(opponent) ? Number(opponent.turnData.indelaOpponentTax || 0) : 0;
  return { amount: tax - reduction, reduction, tax };
}

function playBonus(player, card) {
  if (!isIndela(player)) return { bonus: 0, notes: [] };
  const revealed = player.turnData.indelaRevealedValues || [];
  const cardParity = cardValue(card) % 2;
  const oppositeRevealed = revealed.some((value) => Number(value) % 2 !== cardParity);
  return oppositeRevealed ? { bonus: 1, notes: ["Kashi +1"] } : { bonus: 0, notes: [] };
}

module.exports = { paymentAdjustment, playBonus, revealOmens };
