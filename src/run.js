// ===== Забег: сохранения, правила стола, награды, барахолка =====

const SAVE_KEY = 'kozyr-v-rukave-1';

// Площадка (сейчас — браузер). Для Яндекс Игр сюда подключается SDK: облачные сохранения,
// LoadingAPI.ready(), gameplayStart/Stop и реклама между партиями.
const Platform = {
  read() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },
  write(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* хранилище недоступно — играем без сохранений */ }
  },
  ready() {},
  gameplayStart() {},
  gameplayStop() {},
};

const Store = {
  data: null,
  fresh() {
    return {
      meta: { gamesWon: 0, gamesPlayed: 0, runsWon: 0, runsPlayed: 0, bestAct: 0 },
      settings: { sound: true, fast: false },
      back: 'red',
      run: null,
    };
  },
  load(hot) {
    const d = (hot && hot.save) || Platform.read();
    const f = this.fresh();
    this.data = d && typeof d === 'object'
      ? { ...f, ...d, meta: { ...f.meta, ...(d.meta || {}) }, settings: { ...f.settings, ...(d.settings || {}) } }
      : f;
  },
  save() { Platform.write(this.data); },
};

function newRun(backId) {
  const run = {
    back: backId,
    hearts: 3,
    maxHearts: 3,
    coins: 4,
    table: 0,
    talismans: [],
    talismanSlots: 5,
    tricks: [],
    trickSlots: 2,
    armorActs: [],
    shop: null,
    stats: { won: 0, lost: 0, draws: 0, coins: 0 },
    seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
  };
  if (backId === 'blue') {
    run.trickSlots = 3;
    run.tricks.push(TRICKS[Math.floor(Math.random() * TRICKS.length)].id);
  }
  if (backId === 'violet') run.talismans.push('perevod');
  if (backId === 'black') { run.talismans.push('dvoynoy'); run.hearts = run.maxHearts = 2; }
  return run;
}

const TOTAL_TABLES = ACTS.length * 3;

function tableInfo(index) {
  const act = Math.floor(index / 3);
  return { act, pos: index % 3, actInfo: ACTS[act], opp: ACTS[act].tables[index % 3] };
}

function buildRules(run, opp) {
  const r = defaultRules();
  for (const id of run.talismans) {
    const t = talismanById(id);
    if (t && t.rules) t.rules(r);
  }
  if (opp.rule && opp.rule.rules) opp.rule.rules(r);
  r.handSize = r.handSize.map((h) => Math.max(3, h));
  return r;
}

function weightedPick(arr, weight, rng) {
  const total = arr.reduce((s, a) => s + weight(a), 0);
  let x = rng() * total;
  for (const a of arr) { x -= weight(a); if (x <= 0) return a; }
  return arr[arr.length - 1];
}

function rollShop(run, rng = Math.random) {
  const act = Math.min(2, Math.floor(run.table / 3));
  const owned = new Set(run.talismans);
  const weight = (t) => RARITY[t.rarity].weight * (t.rarity >= 3 ? 1 + act * 0.9 : 1);
  const offers = [];
  for (let i = 0; i < 3; i++) {
    const pool = TALISMANS.filter((t) => !owned.has(t.id) && !offers.some((o) => o.id === t.id));
    if (!pool.length) break;
    offers.push({ kind: 'talisman', id: weightedPick(pool, weight, rng).id, sold: false });
  }
  const tpool = TRICKS.slice();
  for (let i = 0; i < 2; i++) {
    const t = tpool.splice(Math.floor(rng() * tpool.length), 1)[0];
    offers.push({ kind: 'trick', id: t.id, sold: false });
  }
  return offers;
}

const priceOf = (offer) => (offer.kind === 'talisman' ? talismanById(offer.id) : trickById(offer.id)).price;
const sellPrice = (id) => Math.max(1, Math.floor(talismanById(id).price / 2));

// Одна партия за столом: движок + талисманы + особые правила соперника.
class Match {
  constructor(run, opp, seed) {
    this.run = run;
    this.opp = opp;
    this.rng = mulberry32(seed);
    this.rules = buildRules(run, opp);
    this.g = new DurakGame(this.rules, this.rng);
    this.earned = [];
    this.usedActive = new Set();
    this.peekBout = -1;
    this.listener = null;
    this.g.on((type, ev) => this.onGameEvent(type, ev));
  }

  talismans() { return this.run.talismans.map(talismanById).filter(Boolean); }
  has(id) { return this.run.talismans.includes(id); }
  emit(type, data) { if (this.listener) this.listener(type, data || {}); }

  fx(source) {
    return {
      run: this.run,
      won: this.isWin(),
      earn: (v, label) => {
        if (v <= 0) return;
        this.earned.push({ v, label });
        this.emit('earn', { v, label, source });
      },
      note: (text) => this.emit('note', { text, source }),
      peek: () => { this.peekBout = this.g.boutNo; this.emit('peek'); },
      heal: (n) => { this.run.hearts = Math.min(this.run.maxHearts, this.run.hearts + n); this.emit('heal', { n }); },
    };
  }

  begin() {
    this.g.setup();
    for (const t of this.talismans()) if (t.deal) t.deal(this.fx(t.id), this.g);
    if (this.opp.rule && this.opp.rule.deal) this.opp.rule.deal(this.g);
    this.g.start();
  }

  onGameEvent(type, ev) {
    for (const t of this.talismans()) {
      const h = t.on && t.on[type];
      if (h) h(this.fx(t.id), ev, this.g);
    }
    this.emit(type, ev);
  }

  isWin() {
    const r = this.g.result;
    return r === 'win' || (r === 'draw' && this.has('mirovaya'));
  }

  outcome() {
    if (this.isWin()) return 'win';
    return this.g.result === 'draw' ? 'draw' : 'lose';
  }

  peeking() { return this.peekBout === this.g.boutNo; }

  canUseActive(id) {
    const t = talismanById(id);
    return !!(t && t.active && this.has(id) && !this.usedActive.has(id) && !this.g.over && this.g.actor() === 0 && t.canUse(this.g));
  }

  useActive(id) {
    if (!this.canUseActive(id)) return false;
    this.usedActive.add(id);
    talismanById(id).use(this.fx(id), this.g);
    this.emit('changed');
    return true;
  }

  canUseTrick(id, card) {
    const t = trickById(id);
    if (!t) return false;
    if (t.anytime) return t.can(this.g, this.run);
    if (this.g.over || this.g.actor() !== 0) return false;
    if (t.can && !t.can(this.g, this.run)) return false;
    if (card) return !t.canCard || t.canCard(this.g, card);
    return true;
  }

  useTrick(index, card) {
    const id = this.run.tricks[index];
    const t = trickById(id);
    if (!t || !this.canUseTrick(id, card)) return false;
    if (t.target === 'card' && !card) return false;
    this.run.tricks.splice(index, 1);
    t.use(this.fx(id), this.g, card);
    this.emit('changed');
    return true;
  }

  settle() {
    const lines = [];
    const out = this.outcome();
    if (out === 'win') {
      lines.push({ v: this.opp.reward, label: `Победа над: ${this.opp.name}` });
      if (this.g.hands[1].some((c) => c.r === 6)) lines.push({ v: 2, label: 'Погоны! Дурак остался с шестёркой' });
    }
    const merged = new Map();
    for (const e of this.earned) merged.set(e.label, (merged.get(e.label) || 0) + e.v);
    for (const [label, v] of merged) lines.push({ v, label });
    const before = this.earned.length;
    for (const t of this.talismans()) {
      const h = t.on && t.on.end;
      if (h) h(this.fx(t.id), this.g);
    }
    for (const e of this.earned.slice(before)) lines.push(e);
    return { out, lines, total: lines.reduce((s, l) => s + l.v, 0) };
  }
}
