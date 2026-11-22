// render.js — Stormspire Duel: every pixel the player sees.
// The renderer is a pure function of state: the same code draws the title
// screen, the table, and the win/loss screens the screenshots capture.

import { SUITS, SUIT_CYCLE } from './deck.js';
import { MAX_LIFE, MAX_EMBERS, endSummary } from './engine.js';

const $ = (id) => document.getElementById(id);

/** One card face, built from the card object. */
export function cardElement(card, options = {}) {
  const suit = SUITS[card.suit];
  const el = document.createElement('div');
  el.className = 'card' + (card.kind === 'relic' ? ' relic' : '');
  el.dataset.cardId = String(card.id);
  if (options.selected) el.classList.add('selected');
  if (options.unaffordable) el.classList.add('unaffordable');
  if (options.dealt) {
    el.classList.add('dealt');
    el.style.animationDelay = `${(options.dealtIndex || 0) * 70}ms`;
  }

  const cost = document.createElement('span');
  cost.className = 'card-cost';
  cost.textContent = `◈${card.cost}`;
  cost.title = `${card.cost} embers`;
  el.appendChild(cost);

  if (card.kind === 'relic') {
    const tag = document.createElement('span');
    tag.className = 'relic-tag';
    tag.textContent = 'RELIC';
    el.appendChild(tag);
  }

  const top = document.createElement('div');
  top.className = 'card-top';
  const rank = document.createElement('span');
  rank.className = 'rank';
  rank.textContent = card.kind === 'relic' ? '✦' : String(card.rank);
  rank.style.color = suit.dark;
  const glyph = document.createElement('span');
  glyph.className = 'suit-glyph';
  glyph.textContent = suit.glyph;
  glyph.style.color = suit.colour;
  top.appendChild(rank);
  top.appendChild(glyph);
  el.appendChild(top);

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = card.name;
  el.appendChild(name);

  const art = document.createElement('div');
  art.className = 'card-art';
  art.textContent = suit.glyph;
  art.style.color = suit.colour;
  art.style.textShadow = `0 0 18px ${suit.colour}`;
  el.appendChild(art);

  const text = document.createElement('div');
  text.className = 'card-text';
  text.textContent = card.text;
  el.appendChild(text);

  const power = document.createElement('div');
  power.className = 'card-power';
  power.textContent = `Power ${card.power} · ${suit.name}`;
  el.appendChild(power);
  return el;
}

/** A face-down card back for the rival's hand. */
export function cardBackElement() {
  const el = document.createElement('div');
  el.className = 'card-back';
  el.textContent = '✦';
  return el;
}

/** An empty played-card slot. */
function emptySlotElement(label) {
  const el = document.createElement('div');
  el.className = 'slot-empty';
  el.textContent = label;
  return el;
}

/** The suit-cycle diagram on the title screen: shape + colour + arrows. */
export function renderSuitCycle() {
  const host = $('suit-cycle');
  host.innerHTML = '';
  SUIT_CYCLE.forEach((key, i) => {
    const suit = SUITS[key];
    const chip = document.createElement('span');
    chip.className = 'cycle-chip';
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = suit.glyph;
    glyph.style.color = suit.colour;
    chip.appendChild(glyph);
    const label = document.createElement('span');
    label.textContent = suit.name;
    chip.appendChild(label);
    host.appendChild(chip);
    if (i < SUIT_CYCLE.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'cycle-arrow';
      arrow.textContent = 'beats ›';
      host.appendChild(arrow);
    }
  });
  const note = document.createElement('span');
  note.className = 'cycle-chip';
  note.textContent = '+3 power';
  host.appendChild(note);
}

/** Life bar + number for one side. */
function renderLife(side, life) {
  const bar = $(`${side}-life`);
  const fill = bar.querySelector('.lifefill');
  const number = bar.querySelector('.lifenumber');
  fill.style.width = `${Math.max(0, (life / MAX_LIFE) * 100)}%`;
  number.textContent = `${life} / ${MAX_LIFE}`;
}

/** Ember pips for one side: filled for held, hollow for spent. */
function renderEmbers(side, embers) {
  const host = $(`${side}-embers`);
  host.innerHTML = '';
  for (let i = 0; i < MAX_EMBERS; i++) {
    const pip = document.createElement('span');
    pip.className = 'ember-pip' + (i < embers ? '' : ' spent');
    host.appendChild(pip);
  }
}

/** The HUD: lives, embers, trick, storm, score. */
export function renderHud(state) {
  renderLife('player', state.player.life);
  renderLife('rival', state.rival.life);
  renderEmbers('player', state.player.embers);
  renderEmbers('rival', state.rival.embers);
  $('trick-line').textContent = `Trick ${state.trick + 1} · Storm ${state.storm} · Score ${state.score}`;
  const stormText = state.storm === 0
    ? 'The spire sleeps.'
    : state.storm === 1
      ? 'The storm stirs — every trick hits +1 harder.'
      : `The storm rages at level ${state.storm} — every trick hits +${state.storm} harder.`;
  $('storm-line').textContent = stormText;
}

/** The duel log, newest first. */
export function renderLog(state) {
  const list = $('log-list');
  list.innerHTML = '';
  for (const line of state.log) {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  }
}

/** The table: rival hand, played cards, banner, player hand, actions. */
export function renderTable(state, hooks) {
  const rivalHand = $('rival-hand');
  rivalHand.innerHTML = '';
  for (let i = 0; i < state.rival.hand.length; i++) rivalHand.appendChild(cardBackElement());

  const rivalSlot = $('rival-played');
  rivalSlot.innerHTML = '';
  rivalSlot.appendChild(state.table.rival ? cardElement(state.table.rival) : emptySlotElement("Vex's card"));

  const playerSlot = $('player-played');
  playerSlot.innerHTML = '';
  playerSlot.appendChild(state.table.player ? cardElement(state.table.player) : emptySlotElement('Your card'));

  const banner = $('banner');
  const result = state.table.result;
  banner.className = 'banner';
  if (result) {
    banner.textContent = result.text;
    if (result.winner === 'player') banner.classList.add('win');
    else if (result.winner === 'rival') banner.classList.add('lose');
    else banner.classList.add('tie');
  } else if (state.phase === 'playing') {
    banner.textContent = state.selected
      ? 'Ready. Play it, or pick another card.'
      : 'Play a card to open the trick.';
  }

  const hand = $('player-hand');
  hand.innerHTML = '';
  state.player.hand.forEach((card, index) => {
    const affordable = state.player.embers >= card.cost;
    const el = cardElement(card, {
      selected: state.selected === card.id,
      unaffordable: !affordable,
      dealt: state.phase === 'playing' && !state.table.player,
      dealtIndex: index,
    });
    el.addEventListener('click', () => hooks.onSelectCard(card));
    el.title = `${card.name} — ${card.cost} embers, power ${card.power}. Press ${index + 1} to select.`;
    hand.appendChild(el);
  });

  const playButton = $('play-button');
  const selected = state.player.hand.find((c) => c.id === state.selected) || null;
  const canPlay = state.phase === 'playing' && selected && state.player.embers >= selected.cost;
  playButton.disabled = !canPlay;
  $('channel-button').disabled = state.phase !== 'playing';

  const info = $('selected-info');
  if (selected) {
    const suit = SUITS[selected.suit];
    info.textContent = `${selected.name} — ${suit.name} ${selected.rank ?? 'relic'}, power ${selected.power}, costs ${selected.cost} embers. ${selected.text}`;
  } else if (state.player.hand.every((c) => c.cost > state.player.embers)) {
    info.textContent = 'No card is affordable — channel the storm for embers.';
  } else {
    info.textContent = 'Choose a card from your hand.';
  }
}

/** The win / loss screen, with stats and a flourish on victory. */
export function renderEnd(state) {
  const won = state.phase === 'won';
  const title = $('end-title');
  title.textContent = won ? 'The Spire Is Yours' : 'The Duchess Keeps the Spire';
  title.className = won ? 'win' : 'lose';
  $('end-subtitle').textContent = won
    ? 'Vex bows, her clockwork still. Wren maps the storm — and the storm lets her pass.'
    : 'Your light goes out above the clouds. The spire waits for a rematch.';
  const summary = endSummary(state);
  const stats = $('end-stats');
  stats.innerHTML = '';
  const rows = [
    [String(summary.score), 'Final score'],
    [String(summary.tricksWon), 'Tricks won'],
    [String(summary.tricks), 'Tricks played'],
    [String(summary.damageDealt), 'Damage dealt'],
    [String(summary.relicsPlayed), 'Relics played'],
    [String(summary.stormReached), 'Storm reached'],
  ];
  for (const [num, label] of rows) {
    const cell = document.createElement('div');
    cell.className = 'stat';
    const n = document.createElement('div');
    n.className = 'num';
    n.textContent = num;
    const l = document.createElement('div');
    l.className = 'lbl';
    l.textContent = label;
    cell.appendChild(n);
    cell.appendChild(l);
    stats.appendChild(cell);
  }
  const confetti = $('confetti');
  confetti.innerHTML = '';
  if (won) {
    const colours = ['#ffd97a', '#ff6a3d', '#3da9ff', '#4ade80', '#b388ff'];
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${(i * 23) % 100}%`;
      piece.style.background = colours[i % colours.length];
      piece.style.animationDuration = `${2.2 + (i % 5) * 0.35}s`;
      piece.style.animationDelay = `${(i % 7) * 0.12}s`;
      confetti.appendChild(piece);
    }
  }
}

/** Show exactly one screen, and render it. */
export function render(state, hooks) {
  const title = $('title-screen');
  const table = $('table');
  const end = $('end-screen');
  const hud = $('hud');
  const log = $('log-panel');
  if (state.phase === 'title') {
    title.hidden = false;
    table.hidden = true;
    end.hidden = true;
    hud.hidden = true;
    log.hidden = true;
    renderSuitCycle();
  } else if (state.phase === 'won' || state.phase === 'lost') {
    title.hidden = true;
    table.hidden = true;
    end.hidden = false;
    hud.hidden = false;
    log.hidden = false;
    renderHud(state);
    renderEnd(state);
    renderLog(state);
  } else {
    title.hidden = true;
    table.hidden = false;
    end.hidden = true;
    hud.hidden = false;
    log.hidden = false;
    renderHud(state);
    renderTable(state, hooks);
    renderLog(state);
  }
}
