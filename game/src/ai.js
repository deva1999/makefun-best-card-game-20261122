// ai.js — Stormspire Duel: how Vex, the Clockwork Duchess, picks her card.
// She plays BLIND, like the player: she never sees the card you committed.
// She weighs each card against the range of cards you might hold — the
// average power of the deck, the suit cycle, the storm — and her reasoning is
// logged, so her choices can be read and countered.

import { effectivePower, stormDamageBonus } from './engine.js';

/**
 * Pick the rival's card for this trick, without seeing the player's card.
 * Returns { card, reason } — the reason is shown in the log.
 */
export function chooseRivalCard(state) {
  const rng = state.rng;
  const hand = state.rival.hand;
  const affordable = hand.filter((card) => state.rival.embers >= card.cost);
  const pool = affordable.length > 0 ? affordable : hand;
  if (pool.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;
  let bestReason = '';
  for (const card of pool) {
    const scored = scoreCard(state, card);
    const jitter = rng() * 1.2;
    if (scored.score + jitter > bestScore) {
      bestScore = scored.score + jitter;
      best = card;
      bestReason = scored.reason;
    }
  }
  return { card: best, reason: bestReason };
}

/**
 * Expected value of one candidate card against the player's unknown card.
 * The player's card is modelled as a random draw: power 1–10, a suit bonus
 * (+3) landing one time in four on either side. Damage is the power
 * difference, at least 1 when a trick is won.
 */
function expectedOutcome(state, card) {
  const stormHit = stormDamageBonus(state.storm);
  let dealt = 0;
  let taken = 0;
  let wins = 0;
  let count = 0;
  for (let oppPower = 1; oppPower <= 10; oppPower++) {
    for (const myBonus of [0, 3]) {
      for (const oppBonus of [0, 3]) {
        const myWeight = myBonus === 0 ? 0.75 : 0.25;
        const oppWeight = oppBonus === 0 ? 0.75 : 0.25;
        const weight = myWeight * oppWeight;
        const mine = card.power + myBonus;
        const theirs = oppPower + oppBonus;
        count += weight;
        if (mine > theirs) {
          wins += weight;
          dealt += weight * (Math.max(1, mine - theirs) + stormHit);
        } else if (theirs > mine) {
          taken += weight * (Math.max(1, theirs - mine) + stormHit);
        }
      }
    }
  }
  return { dealt: dealt / count, taken: taken / count, winChance: wins / count };
}

/** Score one candidate card for the rival. */
function scoreCard(state, card) {
  const rival = state.rival;
  const outcome = expectedOutcome(state, card);
  let score = outcome.dealt - outcome.taken * 1.15 + outcome.winChance * 4 - card.cost * 0.4;
  let reason = '';

  if (card.effect === 'mirror') {
    // A mirror always wins by one against anything but a mirror.
    score = 6 - card.cost * 0.4;
    reason = 'Vex holds up the Mirror, ready for anything.';
    if (state.player.tricks >= 2 && state.trick >= 4) score += 2;
  } else if (card.effect === 'mend') {
    const missing = 30 - rival.life;
    score = Math.min(4, missing) * 1.2 - card.cost * 0.4;
    reason = 'Vex reaches for the Pearl to mend her wounds.';
    if (rival.life <= 10) score += 8;
    if (rival.life >= 26) score -= 6;
  } else if (card.effect === 'ward') {
    score = Math.min(5, outcome.taken) * 0.8 - card.cost * 0.4;
    reason = 'Vex raises her Aegis and waits behind it.';
    if (state.player.life <= 8) score += 2;
  } else if (card.effect === 'burn') {
    score += outcome.winChance * 2;
    reason = 'Vex crowns the trick with burning embers.';
  }

  // Relics are precious: do not spend one on a middling trick.
  if (card.kind === 'relic' && card.effect !== 'mend' && card.effect !== 'ward') score -= 1.5;
  // When her life is low, she fights harder for every trick.
  if (rival.life <= 8) score += outcome.winChance * 3;
  // When the player is nearly dead, she goes for the finish.
  if (state.player.life <= 5) score += outcome.winChance * 5;

  if (!reason) {
    if (outcome.winChance >= 0.7) reason = 'Vex plays boldly — she likes her chances.';
    else if (outcome.winChance >= 0.45) reason = 'Vex plays a measured card.';
    else reason = 'Vex throws the trick away cheaply.';
  }
  return { score, reason };
}

/** A short, readable line about the rival's mood, for the title screen. */
export function rivalTaunt(state) {
  if (state.storm >= 3) return '“The storm answers to me now.”';
  if (state.rival.life <= 6) return '“You… you fight well. Finish it, then.”';
  if (state.player.life <= 6) return '“One more trick, little cartographer.”';
  if (state.trick === 0) return '“Five cards, thirty lives. Let us see your map.”';
  return '“Again. I am still counting.”';
}

// Referenced by the engine's tests: a mirror's power against a known card.
export { effectivePower };
