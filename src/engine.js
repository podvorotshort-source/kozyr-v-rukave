// ===== Движок подкидного дурака на двоих =====
// Игрок 0 — человек, игрок 1 — соперник. Колода: deck[0] — открытый козырь под колодой,
// карты берутся с конца массива.

const SUITS = ['♠', '♣', '♥', '♦'];
const SUIT_NAMES = ['пики', 'трефы', 'червы', 'бубны'];
const SUIT_GEN = ['пик', 'треф', 'червей', 'бубён'];
const RANK_LABEL = { 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'В', 12: 'Д', 13: 'К', 14: 'Т' };
const RANK_NAME = { 6: 'шестёрка', 7: 'семёрка', 8: 'восьмёрка', 9: 'девятка', 10: 'десятка', 11: 'валет', 12: 'дама', 13: 'король', 14: 'туз' };
const isRed = (s) => s >= 2;
const sameColor = (a, b) => isRed(a) === isRed(b);
const cardName = (c) => `${RANK_LABEL[c.r]}${SUITS[c.s]}`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function defaultRules() {
  return {
    minRank: 6,
    handSize: [6, 6],
    limit: [6, 6],            // сколько карт может быть в одном отбое, когда атакует этот игрок
    firstBoutLimit: [5, 5],   // в первом отбое — не больше пяти
    transfer: [false, false], // переводной
    sixBeatsAce: [false, false],
    queenSpades: [false, false],
    jacksTrump: [false, false],
    doubleTrump: [false, false],
    neighborThrow: [false, false],
    freeThrowOnTake: [false, false],
    firstAttacker: null,
  };
}

class DurakGame {
  constructor(rules, rng) {
    this.rules = rules;
    this.rng = rng;
    this.deck = [];
    this.hands = [[], []];
    this.table = [];          // [{a, by, d, dby}]
    this.discard = [];
    this.trumpSuit = 0;
    this.attacker = 0;
    this.defender = 1;
    this.taking = false;
    this.defStart = 0;
    this.boutNo = 0;
    this.over = false;
    this.result = null;       // 'win' | 'lose' | 'draw' — с точки зрения игрока 0
    this.known = [new Set(), new Set()]; // карты, которые все видели у игрока в руке
    this.cards = new Map();
    this.listeners = [];
    this.stats = { bito: [0, 0], took: [0, 0], played: [0, 0] };
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn(type, data, this); }

  setup() {
    let id = 0;
    for (let s = 0; s < 4; s++) {
      for (let r = this.rules.minRank; r <= 14; r++) {
        const c = { id: id++, s, r, wild: false };
        this.deck.push(c);
        this.cards.set(c.id, c);
      }
    }
    shuffle(this.deck, this.rng);
    const maxHand = Math.max(...this.rules.handSize);
    for (let i = 0; i < maxHand; i++) {
      for (const p of [0, 1]) {
        if (this.hands[p].length < this.rules.handSize[p] && this.deck.length > 1) this.hands[p].push(this.deck.pop());
      }
    }
    this.trumpSuit = this.deck[0].s;
  }

  get trumpCard() { return this.deck.length ? this.deck[0] : null; }
  get deckSize() { return this.rules.minRank === 6 ? 36 : (15 - this.rules.minRank) * 4; }

  start() {
    let first = this.rules.firstAttacker;
    if (first == null) {
      let best = null;
      for (const p of [0, 1]) {
        for (const c of this.hands[p]) {
          if (c.s === this.trumpSuit && (!best || c.r < best.r)) best = { p, r: c.r };
        }
      }
      first = best ? best.p : (this.rng() < 0.5 ? 0 : 1);
    }
    this.attacker = first;
    this.defender = 1 - first;
    this.defStart = this.hands[this.defender].length;
    this.emit('start', { attacker: first });
  }

  // ---- правила старшинства ----
  isTrump(c, who) {
    if (c.s === this.trumpSuit) return true;
    if (this.rules.jacksTrump[who] && c.r === 11) return true;
    if (this.rules.doubleTrump[who] && sameColor(c.s, this.trumpSuit)) return true;
    return false;
  }

  power(c) { return c.r * 2 + (c.s === this.trumpSuit ? 1 : 0); }

  canBeat(att, attWho, def, defWho) {
    if (def.wild) return true;
    const aT = this.isTrump(att, attWho);
    const dT = this.isTrump(def, defWho);
    if (this.rules.sixBeatsAce[defWho] && def.r === 6 && att.r === 14 && def.s === att.s) return true;
    if (this.rules.queenSpades[defWho] && def.r === 12 && def.s === 0 && !aT) return true;
    if (dT && !aT) return true;
    if (aT && !dT) return false;
    if (aT && dT) return this.power(def) > this.power(att);
    return def.s === att.s && def.r > att.r;
  }

  // ---- состояние отбоя ----
  hasUnbeaten() { return this.table.some((e) => !e.d); }
  allBeaten() { return this.table.length > 0 && this.table.every((e) => e.d); }

  tableRanks() {
    const s = new Set();
    for (const e of this.table) { s.add(e.a.r); if (e.d) s.add(e.d.r); }
    return s;
  }

  boutLimit(who) {
    const lim = this.rules.limit[who];
    return this.boutNo === 0 ? Math.min(lim, this.rules.firstBoutLimit[who]) : lim;
  }

  capacity() { return Math.min(this.boutLimit(this.attacker), this.defStart); }

  // Чей сейчас ход: атакующий подкидывает только когда всё отбито (или когда соперник берёт).
  actor() {
    if (this.over) return null;
    if (this.taking) return this.attacker;
    if (this.hasUnbeaten()) return this.defender;
    return this.attacker;
  }

  rankAllowed(c, who) {
    if (this.table.length === 0) return true;
    if (this.taking && this.rules.freeThrowOnTake[who]) return true;
    const ranks = this.tableRanks();
    if (ranks.has(c.r)) return true;
    return this.rules.neighborThrow[who] && (ranks.has(c.r - 1) || ranks.has(c.r + 1));
  }

  legalAttacks(who) {
    if (this.over || who !== this.attacker || this.actor() !== who) return [];
    if (this.table.length >= this.capacity()) return [];
    return this.hands[who].filter((c) => this.rankAllowed(c, who));
  }

  defendTargets(who, card) {
    if (this.over || who !== this.defender || this.taking) return [];
    const res = [];
    this.table.forEach((e, i) => {
      if (!e.d && this.canBeat(e.a, e.by, card, who)) res.push(i);
    });
    return res;
  }

  canTransferWith(who, card) {
    if (this.over || who !== this.defender || this.taking || !this.rules.transfer[who]) return false;
    if (this.table.length === 0 || this.table.some((e) => e.d)) return false;
    if (!this.table.every((e) => e.a.r === card.r)) return false;
    const newDef = this.attacker;
    return this.table.length + 1 <= Math.min(this.boutLimit(who), this.hands[newDef].length);
  }

  canTake(who) { return !this.over && who === this.defender && !this.taking && this.hasUnbeaten(); }
  canPass(who) { return !this.over && who === this.attacker && !this.taking && this.allBeaten(); }
  canFinishTake(who) { return !this.over && who === this.attacker && this.taking; }

  // ---- действия ----
  _fromHand(who, id) {
    const h = this.hands[who];
    const i = h.findIndex((c) => c.id === id);
    if (i < 0) return null;
    return h.splice(i, 1)[0];
  }

  attack(who, id) {
    const card = this.hands[who].find((c) => c.id === id);
    if (!card || !this.legalAttacks(who).includes(card)) return false;
    this._fromHand(who, id);
    this.table.push({ a: card, by: who, d: null, dby: null });
    this.stats.played[who]++;
    const kind = this.table.length === 1 ? 'lead' : (this.taking ? 'chase' : 'throw');
    this.emit('attack', { who, card, kind });
    return true;
  }

  defend(who, id, target) {
    const card = this.hands[who].find((c) => c.id === id);
    const e = this.table[target];
    if (!card || !e || e.d || who !== this.defender || this.taking || this.over) return false;
    if (!this.canBeat(e.a, e.by, card, who)) return false;
    this._fromHand(who, id);
    e.d = card;
    e.dby = who;
    this.stats.played[who]++;
    this.emit('defend', { who, card, target: e.a });
    return true;
  }

  transfer(who, id) {
    const card = this.hands[who].find((c) => c.id === id);
    if (!card || !this.canTransferWith(who, card)) return false;
    this._fromHand(who, id);
    this.table.push({ a: card, by: who, d: null, dby: null });
    const oldAttacker = this.attacker;
    this.attacker = who;
    this.defender = oldAttacker;
    this.defStart = this.hands[oldAttacker].length;
    this.stats.played[who]++;
    this.emit('transfer', { who, card });
    return true;
  }

  take(who) {
    if (!this.canTake(who)) return false;
    this.taking = true;
    this.emit('take', { who });
    return true;
  }

  pass(who) {
    if (!this.canPass(who)) return false;
    this._endBout(false);
    return true;
  }

  finishTake(who) {
    if (!this.canFinishTake(who)) return false;
    this._endBout(true);
    return true;
  }

  _endBout(taken) {
    const entries = this.table;
    const cards = [];
    for (const e of entries) { cards.push(e.a); if (e.d) cards.push(e.d); }
    const att = this.attacker;
    const def = this.defender;
    this.table = [];
    this.taking = false;
    if (taken) {
      this.hands[def].push(...cards);
      for (const c of cards) this.known[def].add(c.id);
      this.stats.took[def]++;
      this.emit('took', { who: def, cards, entries });
    } else {
      this.discard.push(...cards);
      this.stats.bito[def]++;
      this.emit('bito', { attacker: att, defender: def, cards, entries });
    }
    this.boutNo++;
    this._drawUpTo(att);
    this._drawUpTo(def);
    if (!taken) { this.attacker = def; this.defender = att; }
    this.defStart = this.hands[this.defender].length;
    this._checkEnd();
    if (!this.over) this.emit('bout', { attacker: this.attacker });
  }

  _drawUpTo(p) {
    const drawn = [];
    while (this.hands[p].length < this.rules.handSize[p] && this.deck.length) {
      const c = this.deck.pop();
      this.hands[p].push(c);
      drawn.push(c);
    }
    if (drawn.length) this.emit('draw', { who: p, cards: drawn });
  }

  _checkEnd() {
    if (this.deck.length) return;
    const out0 = this.hands[0].length === 0;
    const out1 = this.hands[1].length === 0;
    if (!out0 && !out1) return;
    this.over = true;
    this.result = out0 && out1 ? 'draw' : out0 ? 'win' : 'lose';
    this.emit('over', { result: this.result });
  }

  // ---- служебное для фокусов и талисманов ----
  cardsInHand(who) { return this.hands[who]; }

  moveToDiscard(who, id) {
    const c = this._fromHand(who, id);
    if (!c) return null;
    this.discard.push(c);
    this.emit('discarded', { who, card: c });
    return c;
  }

  give(from, id) {
    const c = this._fromHand(from, id);
    if (!c) return null;
    const to = 1 - from;
    this.hands[to].push(c);
    this.known[to].add(c.id);
    this.emit('gave', { from, to, card: c });
    return c;
  }

  // Вернуть руку в колоду (над открытым козырем), перемешать и добрать столько же.
  reshuffleHand(who) {
    if (!this.deck.length) return false;
    const n = this.hands[who].length;
    const bottom = this.deck[0];
    const rest = this.deck.slice(1).concat(this.hands[who]);
    this.hands[who] = [];
    shuffle(rest, this.rng);
    this.deck = [bottom, ...rest];
    for (let i = 0; i < n && this.deck.length; i++) this.hands[who].push(this.deck.pop());
    this.known[who].clear();
    this.emit('reshuffled', { who });
    return true;
  }

  // Карта из колоды (не открытый козырь), отвечающая условию — для «подтасовок» при раздаче.
  pullFromDeck(pred) {
    const idx = [];
    for (let i = 1; i < this.deck.length; i++) if (pred(this.deck[i])) idx.push(i);
    if (!idx.length) return null;
    const i = idx[Math.floor(this.rng() * idx.length)];
    return { card: this.deck[i], index: i };
  }

  // Проверка целостности: каждая карта ровно в одном месте.
  checkIntegrity() {
    const seen = new Set();
    const add = (c, where) => {
      if (seen.has(c.id)) throw new Error(`карта ${cardName(c)} дважды (${where})`);
      seen.add(c.id);
    };
    this.deck.forEach((c) => add(c, 'колода'));
    this.hands[0].forEach((c) => add(c, 'рука 0'));
    this.hands[1].forEach((c) => add(c, 'рука 1'));
    this.discard.forEach((c) => add(c, 'бита'));
    for (const e of this.table) { add(e.a, 'стол'); if (e.d) add(e.d, 'стол'); }
    if (seen.size !== this.cards.size) throw new Error(`потерялись карты: ${seen.size}/${this.cards.size}`);
    if (this.table.length > 6) throw new Error('больше шести карт в отбое');
    return true;
  }
}
