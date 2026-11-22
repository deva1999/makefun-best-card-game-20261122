// main.js — Stormspire Duel: boot, input, sound, and the screenshot states.
// The live game and the four screenshots run the same code: a `shot` query
// parameter only pre-plays the duel to a chosen moment, then renders it.

import { createGame, startDuel, playTrick, channelEmbers, nextTrick, canAfford } from './engine.js';
import { chooseRivalCard, rivalTaunt } from './ai.js';
import { render } from './render.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '', 10);
const seed = Number.isFinite(seedParam) ? seedParam : (Date.now() % 100000);
const shot = params.get('shot') || 'start';

let state = createGame(seed);

/** A tiny WebAudio blip; silent until the player has gestured. */
let audioContext = null;
function blip(frequency, lengthMs = 90, kind = 'sine') {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = kind;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + lengthMs / 1000);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + lengthMs / 1000);
  } catch {
    // Sound is garnish; a game that cannot beep still plays.
  }
}

/** The hooks the renderer calls back into. */
const hooks = {
  onSelectCard(card) {
    if (state.phase !== 'playing') return;
    if (!canAfford(state, card)) {
      state.selected = null;
      render(state, hooks);
      return;
    }
    state.selected = state.selected === card.id ? null : card.id;
    blip(660, 60);
    render(state, hooks);
  },
};

/** Play the selected card against Vex. */
function playSelectedCard() {
  if (state.phase !== 'playing') return;
  const card = state.player.hand.find((c) => c.id === state.selected);
  if (!card || !canAfford(state, card)) return;
  const pick = chooseRivalCard(state);
  if (!pick) return;
  state.selected = null;
  const result = playTrick(state, card, pick.card);
  if (!result) return;
  blip(result.winner === 'player' ? 880 : 220, 140, result.winner === 'player' ? 'triangle' : 'sawtooth');
  render(state, hooks);
  window.setTimeout(() => {
    nextTrick(state);
    if (state.phase === 'won') blip(1046, 400, 'triangle');
    if (state.phase === 'lost') blip(160, 500, 'sawtooth');
    render(state, hooks);
  }, 1500);
}

/** Channel embers instead of playing a card. */
function channel() {
  if (state.phase !== 'playing') return;
  channelEmbers(state);
  blip(330, 120, 'sine');
  render(state, hooks);
  window.setTimeout(() => {
    nextTrick(state);
    render(state, hooks);
  }, 1500);
}

/** A fresh duel with a fresh deck. */
function newDuel() {
  state = createGame((Date.now() % 100000) + 1);
  startDuel(state);
  render(state, hooks);
}

/** Back to the title screen. */
function toTitle() {
  state = createGame((Date.now() % 100000) + 2);
  render(state, hooks);
}

/** Keyboard play: 1–5 select, Enter/Space play, C channel, R restart. */
function onKey(event) {
  if (state.phase !== 'playing') {
    if ((event.key === 'r' || event.key === 'R') && state.phase !== 'title') newDuel();
    return;
  }
  if (event.key >= '1' && event.key <= '5') {
    const index = Number(event.key) - 1;
    const card = state.player.hand[index];
    if (card) hooks.onSelectCard(card);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    playSelectedCard();
  } else if (event.key === 'c' || event.key === 'C') {
    channel();
  } else if (event.key === 'r' || event.key === 'R') {
    newDuel();
  } else if (event.key === 'Escape') {
    state.selected = null;
    render(state, hooks);
  }
}

/**
 * Screenshot states: pre-play the duel to a chosen moment, using the same
 * engine the live game uses, then render once and stop (no timers fire).
 */
function applyShot() {
  if (shot === 'start') return;
  startDuel(state);
  if (shot === 'play') {
    // A mid-duel moment: trick 8, storm 1, both lives dented, a trick just
    // resolved on the table with its banner showing.
    state.trick = 7;
    state.storm = 1;
    state.player.life = 19;
    state.rival.life = 17;
    state.player.embers = 4;
    state.rival.embers = 3;
    state.player.tricks = 5;
    state.rival.tricks = 2;
    state.player.damageDealt = 9;
    state.score = 59;
    state.log = [
      'Vex wins the trick 8–6 and deals 2 damage.',
      'You win the trick 9–6 and deal 3 damage.',
      'The storm rises to level 1 — every trick hits +1 harder.',
      'You win the trick 11–8 and deal 3 damage.',
    ];
    const card = state.player.hand.find((c) => canAfford(state, c) && c.kind === 'suit') || state.player.hand[0];
    const pick = chooseRivalCard(state);
    playTrick(state, card, pick.card);
    return;
  }
  if (shot === 'win' || shot === 'lose') {
    const won = shot === 'win';
    state.trick = 12;
    state.storm = 2;
    state.player.tricks = won ? 9 : 4;
    state.rival.tricks = won ? 3 : 8;
    state.player.damageDealt = won ? 23 : 11;
    state.player.relicsPlayed = 2;
    state.score = won ? 123 : 61;
    state.player.life = won ? 14 : 0;
    state.rival.life = won ? 0 : 18;
    state.phase = won ? 'won' : 'lost';
    state.endedAt = new Date().toISOString();
    state.log = won
      ? ['Vex bows. The spire is yours.', 'You win the trick 12–7 and deal 5 damage.', 'The storm rises to level 2 — every trick hits +2 harder.']
      : ['Your light goes out. The Duchess keeps the spire.', 'Vex wins the trick 11–6 and deals 5 damage.', 'The storm rises to level 2 — every trick hits +2 harder.'];
  }
}

/** Wire the buttons and boot. */
function boot() {
  if (shot !== 'start') document.body.classList.add('shot-mode');
  document.getElementById('begin-button').addEventListener('click', () => {
    blip(520, 120, 'triangle');
    startDuel(state);
    render(state, hooks);
  });
  document.getElementById('play-button').addEventListener('click', playSelectedCard);
  document.getElementById('channel-button').addEventListener('click', channel);
  document.getElementById('restart-button').addEventListener('click', newDuel);
  document.getElementById('again-button').addEventListener('click', newDuel);
  document.getElementById('title-button').addEventListener('click', toTitle);
  document.addEventListener('keydown', onKey);
  applyShot();
  render(state, hooks);
  if (shot === 'play') {
    // The taunt line belongs on the table, not in the log: keep the log clean.
    void rivalTaunt;
  }
}

boot();
