// engine.js — Stormspire Duel: the rules, the trick, the storm, the score.
// Pure logic, no DOM: the same functions drive the live game and the
// screenshot states, and Node can run them for a logic test.

import { SUITS, buildDeck, drawCards, suitBeats, mulberry32 } from './deck.js';

export const MAX_LIFE = 30;
export const MAX_EMBERS = 6;
export const HAND_SIZE = 5;
export const STORM_EVERY = 5;
export const SUIT_BONUS = 3;
export const WARD_AMOUNT = 5;
export const MEND_AMOUNT = 4;
export const BURN_AMOUNT = 2;
export const EMBER_START = 3;
export const EMBER_PER_TRICK = 2;
export const CHANNEL_EMBERS = 3;
export const CHANNEL_DAMAGE = 2;

/** A fresh game. `seed` drives the deck and every tie-break. */
export function createGame(seed) {
  const rng = mulberry32(seed);
  const deck = buildDeck(rng);
  const state = {
    seed,
    phase: 'title',
    trick: 0,
    storm: 0,
    player: { life: MAX_LIFE, embers: EMBER_START, hand: [], tricks: 0, damageDealt: 0, relicsPlayed: 0, ward: 0 },
    rival: { life: MAX_LIFE, embers: EMBER_START, hand: [], tricks: 0, damageDealt: 0, relicsPlayed: 0, ward: 0 },
    deck,
    discard: [],
    table: { player: null, rival: null, result: null },
    log: [],
    selected: null,
    score: 0,
    endedAt: null,
  };
  drawCards(state.deck, state.discard, state.player.hand, HAND_SIZE, rng);
  drawCards(state.deck, state.discard, state.rival.hand, HAND_SIZE, rng);
  state.rng = rng;
  return state;
}

/** The storm's bite: every trick's damage grows by the storm level, for both sides. */
export function stormDamageBonus(storm) {
  return storm;
}

/** A card's fighting power against a rival card, before the mirror rule. */
export function basePower(card, rivalCard, storm, isRival) {
  let power = card.power;
  if (rivalCard && suitBeats(card.suit, rivalCard.suit)) power += SUIT_BONUS;
  return power;
}

/** A card's effective power once mirrors are resolved. */
export function effectivePower(card, rivalCard, storm, isRival) {
  if (card.effect === 'mirror') {
    if (!rivalCard) return card.power;
    if (rivalCard.effect === 'mirror') return 5;
    return basePower(rivalCard, card, 0, !isRival) + 1;
  }
  return basePower(card, rivalCard, storm, isRival);
}

/** Whether the player can afford to play this card right now. */
export function canAfford(state, card) {
  return state.player.embers >= card.cost;
}

/** The cards in the player's hand they can afford this trick. */
export function affordableCards(state) {
  return state.player.hand.filter((card) => canAfford(state, card));
}

/** Push a line to the log, keeping the last few. */
export function logLine(state, text) {
  state.log.unshift(text);
  if (state.log.length > 5) state.log.length = 5;
}

/** Deal damage to a side, letting ward soak it first. Returns damage that landed. */
export function dealDamage(state, side, amount) {
  const target = state[side];
  let left = amount;
  if (target.ward > 0) {
    const soaked = Math.min(target.ward, left);
    target.ward -= soaked;
    left -= soaked;
    if (soaked > 0) logLine(state, `${side === 'player' ? 'Your' : "Vex's"} ward soaks ${soaked} damage.`);
  }
  if (left > 0) target.life = Math.max(0, target.life - left);
  return left;
}

/** Apply a relic's on-play effect. `side` is who played it. */
export function applyOnPlay(state, side, card) {
  const me = state[side];
  if (card.effect === 'mend') {
    const healed = Math.min(MEND_AMOUNT, MAX_LIFE - me.life);
    me.life += healed;
    logLine(state, `${side === 'player' ? 'You' : 'Vex'} mend${side === 'player' ? '' : 's'} ${healed} life with the ${card.name}.`);
  }
  if (card.effect === 'ward') {
    me.ward += WARD_AMOUNT;
    logLine(state, `${side === 'player' ? 'You raise' : 'Vex raises'} a ward of ${WARD_AMOUNT}.`);
  }
  if (card.kind === 'relic') me.relicsPlayed += 1;
}

/** The storm rises: every STORM_EVERY tricks the rival grows stronger. */
export function maybeRaiseStorm(state) {
  if (state.trick > 0 && state.trick % STORM_EVERY === 0) {
    state.storm += 1;
    logLine(state, `The storm rises to level ${state.storm} — every trick now hits +${state.storm} harder.`);
  }
}

/** Recompute the running score from the player's record. */
export function computeScore(state) {
  return state.player.tricks * 10 + state.player.damageDealt + state.storm * 5;
}

/**
 * Play one trick. `playerCard` must be in the player's hand; `rivalCard` must be
 * in the rival's hand (the caller picks it, usually via the AI). Returns the
 * trick's result record, or null when the play is not allowed.
 */
export function playTrick(state, playerCard, rivalCard) {
  if (state.phase !== 'playing') return null;
  if (!playerCard || !canAfford(state, playerCard)) return null;
  if (!rivalCard) return null;
  state.phase = 'resolving';

  const playerIndex = state.player.hand.indexOf(playerCard);
  const rivalIndex = state.rival.hand.indexOf(rivalCard);
  state.player.hand.splice(playerIndex, 1);
  state.rival.hand.splice(rivalIndex, 1);
  state.player.embers = Math.max(0, state.player.embers - playerCard.cost);
  state.rival.embers = Math.max(0, state.rival.embers - rivalCard.cost);
  state.table.player = playerCard;
  state.table.rival = rivalCard;
  state.discard.push(playerCard, rivalCard);

  applyOnPlay(state, 'player', playerCard);
  applyOnPlay(state, 'rival', rivalCard);

  const playerPower = effectivePower(playerCard, rivalCard, state.storm, false);
  const rivalPower = effectivePower(rivalCard, playerCard, state.storm, true);
  let winner = null;
  let damage = 0;
  let text = '';
  if (playerPower > rivalPower) {
    winner = 'player';
    damage = Math.max(1, playerPower - rivalPower) + stormDamageBonus(state.storm);
    if (playerCard.effect === 'burn') damage += BURN_AMOUNT;
    const landed = dealDamage(state, 'rival', damage);
    state.player.damageDealt += landed;
    state.player.tricks += 1;
    text = `You win the trick ${playerPower}–${rivalPower} and deal ${landed} damage.`;
  } else if (rivalPower > playerPower) {
    winner = 'rival';
    damage = Math.max(1, rivalPower - playerPower) + stormDamageBonus(state.storm);
    if (rivalCard.effect === 'burn') damage += BURN_AMOUNT;
    const landed = dealDamage(state, 'player', damage);
    state.rival.damageDealt += landed;
    state.rival.tricks += 1;
    text = `Vex wins the trick ${rivalPower}–${playerPower} and deals ${landed} damage.`;
  } else {
    text = `A dead tie at ${playerPower} — neither side yields.`;
  }
  logLine(state, text);

  state.trick += 1;
  state.player.embers = Math.min(MAX_EMBERS, state.player.embers + EMBER_PER_TRICK);
  state.rival.embers = Math.min(MAX_EMBERS, state.rival.embers + EMBER_PER_TRICK);
  maybeRaiseStorm(state);
  state.score = computeScore(state);

  state.table.result = { winner, damage, playerPower, rivalPower, text };
  return state.table.result;
}

/** Channel embers instead of playing: forfeit the trick, take a small hit, gain embers. */
export function channelEmbers(state) {
  if (state.phase !== 'playing') return null;
  state.phase = 'resolving';
  const landed = dealDamage(state, 'player', CHANNEL_DAMAGE);
  state.player.embers = Math.min(MAX_EMBERS, state.player.embers + CHANNEL_EMBERS);
  state.trick += 1;
  state.player.embers = Math.min(MAX_EMBERS, state.player.embers + EMBER_PER_TRICK);
  state.rival.embers = Math.min(MAX_EMBERS, state.rival.embers + EMBER_PER_TRICK);
  maybeRaiseStorm(state);
  state.score = computeScore(state);
  logLine(state, `You channel the storm: +${CHANNEL_EMBERS} embers, ${landed} damage taken.`);
  state.table.result = { winner: 'rival', damage: landed, playerPower: 0, rivalPower: 0, text: 'You channel instead of playing.' };
  return state.table.result;
}

/** Draw both sides back up to a full hand, then open the next trick. */
export function nextTrick(state) {
  if (state.phase !== 'resolving') return;
  state.table.player = null;
  state.table.rival = null;
  state.table.result = null;
  state.selected = null;
  drawCards(state.deck, state.discard, state.player.hand, HAND_SIZE, state.rng);
  drawCards(state.deck, state.discard, state.rival.hand, HAND_SIZE, state.rng);
  if (state.player.life <= 0) {
    state.phase = 'lost';
    state.endedAt = new Date().toISOString();
    logLine(state, 'Your light goes out. The Duchess keeps the spire.');
  } else if (state.rival.life <= 0) {
    state.phase = 'won';
    state.endedAt = new Date().toISOString();
    logLine(state, 'Vex bows. The spire is yours.');
  } else {
    state.phase = 'playing';
  }
}

/** Start (or restart) a duel from the title screen. */
export function startDuel(state) {
  state.phase = 'playing';
  state.log = ['The duel begins. Play a card — the higher power takes the trick.'];
  state.table.player = null;
  state.table.rival = null;
  state.table.result = null;
  state.selected = null;
}

/** One-line summary of the duel for the end screens. */
export function endSummary(state) {
  return {
    tricks: state.trick,
    tricksWon: state.player.tricks,
    damageDealt: state.player.damageDealt,
    relicsPlayed: state.player.relicsPlayed,
    stormReached: state.storm,
    score: state.score,
  };
}

export { SUITS };
