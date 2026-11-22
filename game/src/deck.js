// deck.js — Stormspire Duel: the suits, the named cards, the deck, the dice.
// Every card in the game is defined here. Nothing is imported from anywhere
// else in the world: four original suits, forty named suit cards, eight relics.

/** A seeded dice roll, so a screenshot seed replays the same deal. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The four suits. Each has a colour AND a shape glyph, never text alone. */
export const SUITS = {
  ember: { key: 'ember', name: 'Ember', glyph: '▲', colour: '#ff6a3d', dark: '#c23a12', beats: 'gale' },
  tide: { key: 'tide', name: 'Tide', glyph: '●', colour: '#3da9ff', dark: '#1466b8', beats: 'ember' },
  gale: { key: 'gale', name: 'Gale', glyph: '✦', colour: '#4ade80', dark: '#1d8a46', beats: 'stone' },
  stone: { key: 'stone', name: 'Stone', glyph: '■', colour: '#b388ff', dark: '#6d4fc2', beats: 'tide' },
};

/** The suit cycle, for the title screen and the help panel. */
export const SUIT_CYCLE = ['ember', 'gale', 'stone', 'tide'];

/** Whether suit `a` beats suit `b` in the cycle. */
export function suitBeats(a, b) {
  return SUITS[a] && SUITS[a].beats === b;
}

/** Flavour names, one per rank per suit: forty distinct cards. */
export const RANK_NAMES = {
  ember: ['Spark', 'Cinder', 'Flare', 'Blaze', 'Inferno', 'Wildfire', 'Pyre', 'Nova', 'Sunburst', 'Phoenix'],
  tide: ['Droplet', 'Ripple', 'Stream', 'Current', 'Surge', 'Breaker', 'Maelstrom', 'Abyss', 'Monsoon', 'Leviathan'],
  gale: ['Breeze', 'Gust', 'Zephyr', 'Squall', 'Tempest', 'Cyclone', 'Hurricane', 'Typhoon', 'Jetstream', 'Skyrender'],
  stone: ['Pebble', 'Shard', 'Boulder', 'Monolith', 'Bedrock', 'Avalanche', 'Granite', 'Obsidian', 'Colossus', 'Titan'],
};

/** Ember cost of a suit card: cheap sparks, dear titans. */
export function costOfRank(rank) {
  if (rank <= 3) return 1;
  if (rank <= 6) return 2;
  return 3;
}

/** The eight relic cards: two copies of each, with a named effect. */
export const RELICS = [
  {
    key: 'cinder-crown', name: 'Cinder Crown', suit: 'ember', cost: 3, power: 6,
    effect: 'burn', text: 'Burn: +2 damage when you win this trick.',
  },
  {
    key: 'tidecaller-pearl', name: 'Tidecaller Pearl', suit: 'tide', cost: 2, power: 4,
    effect: 'mend', text: 'Mend: restore 4 life when played.',
  },
  {
    key: 'gale-mirror', name: 'Gale Mirror', suit: 'gale', cost: 3, power: 0,
    effect: 'mirror', text: 'Mirror: matches the rival card, then +1.',
  },
  {
    key: 'stoneheart-aegis', name: 'Stoneheart Aegis', suit: 'stone', cost: 2, power: 3,
    effect: 'ward', text: 'Ward: block the next 5 damage.',
  },
];

let nextCardId = 1;

/** One card object. `id` is unique within a game; `uid` is stable per card kind. */
export function makeCard(kind, suit, rank, relic) {
  if (kind === 'suit') {
    return {
      id: nextCardId++,
      uid: `${suit}-${rank}`,
      kind: 'suit',
      name: RANK_NAMES[suit][rank - 1],
      suit,
      rank,
      cost: costOfRank(rank),
      power: rank,
      effect: null,
      text: `${SUITS[suit].name} ${rank} of the spire.`,
    };
  }
  return {
    id: nextCardId++,
    uid: relic.key,
    kind: 'relic',
    name: relic.name,
    suit: relic.suit,
    rank: null,
    cost: relic.cost,
    power: relic.power,
    effect: relic.effect,
    text: relic.text,
  };
}

/** The full 48-card deck, shuffled with the given dice. */
export function buildDeck(rng) {
  nextCardId = 1;
  const deck = [];
  for (const suit of Object.keys(SUITS)) {
    for (let rank = 1; rank <= 10; rank++) deck.push(makeCard('suit', suit, rank));
  }
  for (const relic of RELICS) {
    deck.push(makeCard('relic', null, null, relic));
    deck.push(makeCard('relic', null, null, relic));
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** Draw `n` cards from the deck into a hand (reshuffling the discard when dry). */
export function drawCards(deck, discard, hand, n, rng) {
  while (hand.length < n) {
    if (deck.length === 0) {
      if (discard.length === 0) return;
      while (discard.length > 0) deck.push(discard.pop());
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = deck[i];
        deck[i] = deck[j];
        deck[j] = tmp;
      }
    }
    hand.push(deck.pop());
  }
}
