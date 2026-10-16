// ===== Интерфейс =====

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const COIN = '<i class="coin" aria-hidden="true"></i>';
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
const cardsWord = (n) => `${n} ${plural(n, 'карта', 'карты', 'карт')}`;
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- звук ----------
const Sfx = {
  ctx: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  },
  env(node, gain, dur, when) {
    const t = this.ctx.currentTime + when;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(this.ctx.destination);
    return t;
  },
  noise(dur, freq, q, gain, type = 'bandpass', when = 0) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    const t = this.env(f, gain, dur, when);
    src.start(t);
    src.stop(t + dur + 0.02);
  },
  tone(freq, dur, type, gain, when = 0, slideTo = null) {
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.env(o, gain, dur, when);
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  play(name) {
    if (!Store.data.settings.sound || !this.ctx) return;
    try {
      switch (name) {
        case 'card': this.noise(0.07, 2300, 0.9, 0.32); this.tone(190, 0.05, 'sine', 0.1); break;
        case 'draw': this.noise(0.05, 4200, 0.7, 0.1, 'highpass'); break;
        case 'bito': this.noise(0.24, 900, 0.6, 0.16); break;
        case 'take': this.tone(150, 0.2, 'sine', 0.22, 0, 70); this.noise(0.12, 600, 0.8, 0.12); break;
        case 'coin': this.tone(1320, 0.09, 'triangle', 0.11); this.tone(1760, 0.16, 'triangle', 0.09, 0.06); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.13, i * 0.09)); break;
        case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.32, 'sawtooth', 0.05, i * 0.15)); break;
        case 'click': this.tone(880, 0.03, 'square', 0.035); break;
        case 'nope': this.tone(170, 0.12, 'square', 0.045); break;
        case 'buy': this.tone(988, 0.08, 'triangle', 0.12); this.tone(1319, 0.15, 'triangle', 0.11, 0.07); break;
        case 'magic': [660, 880, 1175].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.08, i * 0.05)); break;
        default: break;
      }
    } catch (e) { /* звук не критичен */ }
  },
};

// ---------- эффекты ----------
const Fx = {
  float(x, y, text, cls = '') {
    const e = h('div', `float ${cls}`, text);
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    $('#fx').appendChild(e);
    setTimeout(() => e.remove(), 1400);
  },
  floatAt(elem, text, cls) {
    if (!elem) return;
    const r = elem.getBoundingClientRect();
    this.float(r.left + r.width / 2, r.top + r.height / 2, text, cls);
  },
  banner(text) {
    const e = h('div', 'banner', esc(text));
    $('#fx').appendChild(e);
    setTimeout(() => e.remove(), 1150);
  },
  wiggle(elem) {
    if (!elem) return;
    elem.classList.remove('fire');
    void elem.offsetWidth;
    elem.classList.add('fire');
  },
};

// ---------- рисунок карты ----------
const PIPS = {
  6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  7: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [30, 80], [70, 80]],
  8: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [50, 65], [30, 80], [70, 80]],
  9: [[30, 18], [70, 18], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 82], [70, 82]],
  10: [[30, 18], [70, 18], [50, 29], [30, 39], [70, 39], [30, 61], [70, 61], [50, 71], [30, 82], [70, 82]],
};

function faceHTML(c) {
  const suit = SUITS[c.s];
  const rank = RANK_LABEL[c.r];
  let center;
  if (c.r <= 10) {
    center = `<div class="pips">${PIPS[c.r].map(([x, y]) => `<span class="pip${y > 55 ? ' flip' : ''}" style="left:${x}%;top:${y}%">${suit}</span>`).join('')}</div>`;
  } else if (c.r === 14) {
    center = `<div class="ace"><span>${suit}</span></div>`;
  } else {
    center = `<div class="court" data-s="${suit}"><b>${rank}</b><i>${suit}</i></div>`;
  }
  let badges = '';
  if (c.wild) badges += '<span class="badge wild">★</span>';
  if (c.boosted) badges += '<span class="badge">↑</span>';
  if (c.painted) badges += '<span class="badge">✎</span>';
  return `<div class="corner tl"><b>${rank}</b><i>${suit}</i></div>${center}<div class="corner br"><b>${rank}</b><i>${suit}</i></div>${badges}`;
}

function cardEl(c, faceUp = true) {
  const e = h('div', `card${isRed(c.s) ? ' red' : ''}${faceUp ? '' : ' down'}`);
  e.innerHTML = `<div class="cin"><div class="front">${faceHTML(c)}</div><div class="back"></div></div>`;
  return e;
}

// Порядок в руке: масти чередуются по цвету, козыри — справа.
const SUIT_ORDER = [0, 2, 1, 3];
function sortHand(g, cards) {
  return cards.slice().sort((a, b) => {
    const ta = g.isTrump(a, 0) ? 1 : 0;
    const tb = g.isTrump(b, 0) ? 1 : 0;
    if (ta !== tb) return ta - tb;
    if (ta && tb) return g.power(a) - g.power(b) || SUIT_ORDER.indexOf(a.s) - SUIT_ORDER.indexOf(b.s);
    if (a.s !== b.s) return SUIT_ORDER.indexOf(a.s) - SUIT_ORDER.indexOf(b.s);
    return a.r - b.r;
  });
}

// ---------- стол ----------
const Board = {
  root: null,
  els: new Map(),
  L: null,
  match: null,
  bubbleTimer: null,

  init() {
    this.root = $('#board');
    this.root.addEventListener('click', (e) => {
      const choice = e.target.closest('.choice button');
      if (choice) return;
      const c = e.target.closest('.card');
      if (c) Play.cardClick(Number(c.dataset.id));
      else Play.backgroundClick();
    });
    this.root.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) {
        e.preventDefault();
        e.stopPropagation();
        Play.cardClick(Number(e.target.dataset.id));
      }
    });
  },

  reset(match) {
    for (const e of this.els.values()) e.remove();
    this.els.clear();
    $$('.choice, .bubble', this.root).forEach((e) => e.remove());
    this.match = match;
    const opp = match.opp;
    $('#opp').innerHTML = `
      <div class="portrait${opp.boss ? ' boss' : ''}">${opp.icon}</div>
      <div>
        <div class="opp-name">${esc(opp.name)}</div>
        <div class="opp-rule">${opp.rule ? `<b>Правило:</b> ${esc(opp.rule.text)}` : esc(opp.title)}</div>
      </div>`;
  },

  layout() {
    const r = this.root;
    const W = r.clientWidth;
    const H = r.clientHeight;
    if (!W || !H) return;
    const portrait = W < 720;
    let cw = portrait ? Math.min(W / 4.7, (H - 30) / 7.3) : Math.min(W / 8.9, (H - 20) / 5.8);
    cw = Math.round(Math.max(42, Math.min(cw, 120)));
    const ch = Math.round(cw * 1.4);
    r.style.setProperty('--cw', `${cw}px`);
    r.style.setProperty('--ch', `${ch}px`);
    r.classList.toggle('narrow', portrait);

    const oppS = portrait ? 0.56 : 0.64;
    const oppPanelH = portrait ? 52 : 0;
    const oppY = oppPanelH + 6 + (ch * oppS) / 2;
    const handY = H - ch / 2 - (portrait ? 10 : 16);
    const hudH = portrait ? 48 : 54;
    const hudY = handY - ch / 2 - hudH / 2 - 8;
    const sideS = portrait ? 0.62 : 0.86;
    const scw = cw * sideS;
    const sch = ch * sideS;
    const tableTop = oppY + (ch * oppS) / 2 + 12;
    const tableBot = hudY - hudH / 2 - 6;
    const tableY = (tableTop + tableBot) / 2;
    const deckX = scw / 2 + 2;
    const bitoX = W - scw / 2 - 2;
    const left = deckX + scw / 2 + sch * 0.3 + 8;
    const right = bitoX - scw / 2 - 8;
    const tw = right - left;
    let cols = portrait ? (tw / 3 >= cw * 1.1 ? 3 : 2) : (tw >= cw * 1.24 * 6 * 0.92 ? 6 : 3);
    const pairW = Math.min(cw * 1.24, tw / cols);
    const pairH = ch * 1.18;
    this.L = { W, H, cw, ch, portrait, oppS, oppY, handY, hudY, hudH, sideS, scw, sch, tableY, deckX, bitoX, cx: (left + right) / 2, cols, pairW, pairH };

    const dp = $('#deck-pile');
    dp.style.transform = `translate(${deckX - cw / 2}px, ${tableY - ch / 2}px) scale(${sideS})`;
    const bp = $('#bito-pile');
    bp.style.transform = `translate(${bitoX - cw / 2}px, ${tableY - ch / 2}px) scale(${sideS})`;
    const chip = $('#trump-chip');
    chip.style.left = `${deckX + scw * 0.2}px`;
    chip.style.top = `${tableY + sch / 2 + (portrait ? 24 : 34)}px`;
    const hud = $('#hud');
    hud.style.top = `${hudY - hudH / 2}px`;
    hud.style.height = `${hudH}px`;
    hud.style.justifyContent = portrait ? 'space-between' : 'center';
  },

  tableSlot(i, k) {
    const L = this.L;
    const cols = L.cols;
    const rows = Math.ceil(k / cols);
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, k - row * cols);
    return {
      x: L.cx + (col - (inRow - 1) / 2) * L.pairW - L.cw * 0.08,
      y: L.tableY + (row - (rows - 1) / 2) * L.pairH - L.ch * 0.06,
    };
  },

  jitter(id) { return (((id * 37) % 7) - 3) * 0.8; },

  targets() {
    const m = this.match;
    const g = m.g;
    const L = this.L;
    const T = new Map();
    const glaz = m.has('glaz');

    // колода и открытый козырь
    if (g.deck.length) {
      const tc = g.deck[0];
      T.set(tc.id, { x: L.deckX + L.scw * 0.45, y: L.tableY, rot: 90, s: L.sideS, z: 1, up: true });
      if (g.deck.length > 1) {
        const top = g.deck[g.deck.length - 1];
        T.set(top.id, { x: L.deckX, y: L.tableY, rot: -2, s: L.sideS, z: 3, up: glaz });
      }
    }

    // рука соперника
    const oh = g.hands[1];
    const ow = L.cw * L.oppS;
    const oppW = L.portrait ? L.W - 8 : Math.max(L.cw * 2, L.W - 600);
    const on = oh.length;
    const osp = on > 1 ? Math.min(ow * 0.62, (oppW - ow) / (on - 1)) : 0;
    const ox0 = L.W / 2 - (ow + osp * (on - 1)) / 2 + ow / 2;
    const peek = m.peeking() || g.over;
    const mem = m.has('pamyat');
    oh.forEach((c, i) => {
      T.set(c.id, {
        x: ox0 + i * osp, y: L.oppY, rot: (i - (on - 1) / 2) * -1.1, s: L.oppS, z: 20 + i,
        up: peek || (mem && g.known[1].has(c.id)),
      });
    });

    // стол
    const k = g.table.length;
    g.table.forEach((e, i) => {
      const p = this.tableSlot(i, k);
      T.set(e.a.id, { x: p.x, y: p.y, rot: this.jitter(e.a.id), s: 1, z: 40 + i * 2, up: true, cls: e.d ? '' : 'open' });
      if (e.d) T.set(e.d.id, { x: p.x + L.cw * 0.18, y: p.y + L.ch * 0.15, rot: 8 + this.jitter(e.d.id), s: 1, z: 41 + i * 2, up: true });
    });

    // своя рука
    const ph = sortHand(g, g.hands[0]);
    const n = ph.length;
    const availW = L.portrait ? L.W - 4 : Math.min(L.W - 2 * L.cw, L.cw * 11.5);
    const sp = n > 1 ? Math.min(L.cw * 0.8, (availW - L.cw) / (n - 1)) : 0;
    const x0 = L.W / 2 - (L.cw + sp * (n - 1)) / 2 + L.cw / 2;
    const mid = (n - 1) / 2;
    ph.forEach((c, i) => {
      const off = mid > 0 ? (i - mid) / mid : 0;
      T.set(c.id, {
        x: x0 + i * sp,
        y: L.handY + off * off * L.ch * 0.05,
        rot: (i - mid) * Math.min(3, 24 / Math.max(n, 1)),
        s: 1, z: 60 + i, up: true, mine: true,
      });
    });
    return T;
  },

  transform(t) {
    const L = this.L;
    return `translate(${t.x - L.cw / 2}px, ${t.y - L.ch / 2}px) rotate(${t.rot || 0}deg) scale(${t.s || 1})`;
  },

  render(opts = {}) {
    const m = this.match;
    if (!m || !this.L) return;
    const g = m.g;
    const L = this.L;
    const T = this.targets();
    const myTurn = g.actor() === 0 && !Play.busy && !g.over;

    // что сейчас можно сыграть
    const playable = new Set();
    if (myTurn) {
      if (UI.targeting) {
        for (const c of g.hands[0]) if (m.canUseTrick(UI.targeting.id, c)) playable.add(c.id);
      } else if (g.attacker === 0) {
        for (const c of g.legalAttacks(0)) playable.add(c.id);
      } else {
        for (const c of g.hands[0]) if (g.defendTargets(0, c).length || g.canTransferWith(0, c)) playable.add(c.id);
      }
    }
    const tgt = new Set();
    if (UI.pendingDefend != null) {
      const card = g.hands[0].find((c) => c.id === UI.pendingDefend);
      if (card) for (const i of g.defendTargets(0, card)) tgt.add(g.table[i].a.id);
    }

    let dealIndex = 0;
    for (const [id, t] of T) {
      const c = g.cards.get(id);
      let e = this.els.get(id);
      const fresh = !e;
      if (fresh) {
        e = h('div', 'card down');
        e.dataset.id = id;
        e.innerHTML = '<div class="cin"><div class="front"></div><div class="back"></div></div>';
        this.root.appendChild(e);
        this.els.set(id, e);
        const from = { x: L.deckX, y: L.tableY, rot: -2, s: L.sideS };
        e.style.transition = 'none';
        e.style.transform = this.transform(from);
        void e.offsetWidth;
        e.style.transition = '';
        if (opts.deal) e.style.transitionDelay = `${dealIndex++ * 45}ms`;
      } else if (e._leaving) {
        e._leaving = false;
        clearTimeout(e._leaveTimer);
      }
      const sig = `${c.r}|${c.s}|${c.wild}|${c.boosted}|${c.painted}`;
      if (e._sig !== sig) {
        e._sig = sig;
        e.querySelector('.front').innerHTML = faceHTML(c);
        e.classList.toggle('red', isRed(c.s));
        e.classList.toggle('wild', !!c.wild);
      }
      e.classList.toggle('down', !t.up);
      e.classList.toggle('mine', !!t.mine);
      e.classList.toggle('trump', !!t.mine && g.isTrump(c, 0));
      e.classList.toggle('playable', playable.has(id) || tgt.has(id));
      e.classList.toggle('dim', !!t.mine && myTurn && !playable.has(id));
      e.classList.toggle('sel', UI.pendingDefend === id || (UI.choiceFor === id));
      e.classList.toggle('tgt', tgt.has(id));
      e.classList.toggle('open', t.cls === 'open');
      if (t.mine && playable.has(id)) e.tabIndex = 0; else e.removeAttribute('tabindex');
      const instant = opts.instant && !fresh;
      if (instant) e.style.transition = 'none';
      e.style.zIndex = t.z;
      e.style.transform = this.transform(t);
      if (instant) {
        void e.offsetWidth;
        e.style.transition = '';
      }
    }
    if (opts.deal) setTimeout(() => { for (const e of this.els.values()) e.style.transitionDelay = ''; }, 1400);

    // карты, ушедшие со стола
    for (const [id, e] of this.els) {
      if (T.has(id) || e._leaving) continue;
      e._leaving = true;
      const inDiscard = g.discard.some((c) => c.id === id);
      const inDeck = g.deck.some((c) => c.id === id);
      const to = inDiscard
        ? { x: L.bitoX, y: L.tableY, rot: this.jitter(id) * 4, s: L.sideS, z: 35 }
        : inDeck ? { x: L.deckX, y: L.tableY, rot: -2, s: L.sideS, z: 2 } : { x: L.W / 2, y: -L.ch, s: 1, z: 1 };
      e.classList.add('down');
      e.classList.remove('mine', 'playable', 'dim', 'sel', 'tgt', 'trump', 'open');
      e.style.zIndex = to.z;
      e.style.transform = this.transform(to);
      e._leaveTimer = setTimeout(() => {
        if (!e._leaving) return;
        e.remove();
        this.els.delete(id);
        this.renderPiles();
      }, 480);
    }
    this.renderPiles();
  },

  renderPiles() {
    const g = this.match.g;
    const dp = $('#deck-pile');
    dp.hidden = g.deck.length < 2;
    $('.stack', dp).style.visibility = g.deck.length > 2 ? 'visible' : 'hidden';
    $('.count', dp).textContent = g.deck.length ? `${g.deck.length}` : '';
    const leaving = [...this.els.values()].filter((e) => e._leaving).length;
    const bp = $('#bito-pile');
    bp.hidden = g.discard.length - leaving <= 0;
    $('.count', bp).textContent = 'бито';
    const chip = $('#trump-chip');
    const red = isRed(g.trumpSuit);
    chip.innerHTML = `козырь <span class="s${red ? ' red' : ''}">${SUITS[g.trumpSuit]}</span>`;
  },

  say(text) {
    if (!text) return;
    $$('.bubble', this.root).forEach((b) => b.remove());
    clearTimeout(this.bubbleTimer);
    const b = h('div', 'bubble', esc(text));
    const opp = $('#opp');
    const L = this.L;
    if (L && L.portrait) {
      b.style.left = `${Math.min(opp.offsetWidth + 14, L.W - 200)}px`;
      b.style.top = '6px';
    } else {
      b.style.left = `${opp.offsetWidth + 16}px`;
      b.style.top = '10px';
    }
    this.root.appendChild(b);
    this.bubbleTimer = setTimeout(() => b.remove(), 2000);
  },

  showChoice(card, onBeat, onTransfer) {
    this.hideChoice();
    const t = this.targets().get(card.id);
    if (!t) return;
    const box = h('div', 'choice');
    box.innerHTML = '<button class="btn small" data-a="beat">Побить</button><button class="btn small ghost" data-a="tr">Перевести</button>';
    box.style.left = `${Math.max(60, Math.min(this.L.W - 60, t.x))}px`;
    box.style.top = `${t.y - this.L.ch * 0.12}px`;
    box.addEventListener('click', (ev) => {
      const a = ev.target.closest('button');
      if (!a) return;
      ev.stopPropagation();
      this.hideChoice();
      if (a.dataset.a === 'beat') onBeat(); else onTransfer();
    });
    this.root.appendChild(box);
    UI.choiceFor = card.id;
  },

  hideChoice() {
    $$('.choice', this.root).forEach((e) => e.remove());
    UI.choiceFor = null;
  },
};

// ---------- верхняя панель ----------
const HUD = {
  render() {
    const top = $('#topbar');
    const run = App.run;
    if (!run || App.screen === 'menu' || App.screen === 'end') { top.hidden = true; return; }
    top.hidden = false;
    const info = tableInfo(Math.min(run.table, TOTAL_TABLES - 1));
    const m = App.screen === 'game' ? App.match : null;
    const tokens = run.talismans.map((id) => {
      const t = talismanById(id);
      const ready = m && t.active && m.canUseActive(id);
      const spent = m && t.active && m.usedActive.has(id);
      return `<button class="token q${t.rarity}${spent ? ' spent' : ''}" data-kind="t" data-id="${id}" aria-label="${esc(t.name)}">${t.icon}${ready ? '<span class="dot"></span>' : ''}</button>`;
    });
    for (let i = run.talismans.length; i < run.talismanSlots; i++) tokens.push('<span class="slot"></span>');
    const tricks = run.tricks.map((id, i) => {
      const t = trickById(id);
      const armed = UI.targeting && UI.targeting.index === i;
      return `<button class="trick${armed ? ' armed' : ''}" data-kind="k" data-index="${i}" aria-label="${esc(t.name)}">${t.icon}</button>`;
    });
    for (let i = run.tricks.length; i < run.trickSlots; i++) tricks.push('<span class="trick-slot"></span>');
    const html = `
      <div class="hud-group">
        <div class="hearts" aria-label="Сердца: ${run.hearts}">${'♥'.repeat(Math.max(0, run.hearts))}<span class="lost">${'♥'.repeat(Math.max(0, run.maxHearts - run.hearts))}</span></div>
        <div class="coins" aria-label="Монеты">${run.coins}${COIN}</div>
        <div class="progress">Акт ${ROMAN[info.act]} · <b>${esc(info.actInfo.name)}</b> · стол ${info.pos + 1}/3</div>
      </div>
      <div class="trays">
        <div class="tray"><span class="tray-label">Талисманы</span>${tokens.join('')}</div>
        <div class="tray"><span class="tray-label">Фокусы</span>${tricks.join('')}</div>
        <button class="icon-btn" id="btn-pause" aria-label="Меню">☰</button>
      </div>`;
    // Перерисовываем только при изменениях, иначе обрываются анимации жетонов.
    if (top._html !== html) {
      top.innerHTML = html;
      top._html = html;
    }
  },
  token(id) { return $(`#topbar .token[data-id="${id}"]`); },
  coins() { return $('#topbar .coins'); },
};

// ---------- подсказка к талисманам и фокусам ----------
const Tip = {
  anchor: null,
  open(anchor) {
    if (this.anchor === anchor) { this.close(); return; }
    this.anchor = anchor;
    const run = App.run;
    const tip = $('#tip');
    const m = App.screen === 'game' ? App.match : null;
    let html = '';
    const acts = [];
    if (anchor.dataset.kind === 't') {
      const t = talismanById(anchor.dataset.id);
      html = `<h4>${t.icon} ${esc(t.name)}</h4><div class="rar">Талисман · ${RARITY[t.rarity].name}${t.active ? ' · раз за партию' : ''}</div><p>${esc(t.desc)}</p>`;
      if (t.active && m) {
        if (m.usedActive.has(t.id)) html += '<p class="muted">Уже использован в этой партии.</p>';
        else if (m.canUseActive(t.id)) acts.push(['Применить', () => { m.useActive(t.id); Sfx.play('magic'); Play.step(); }]);
        else html += '<p class="muted">Сейчас применить нельзя.</p>';
      }
      if (App.screen === 'shop') acts.push([`Продать за ${sellPrice(t.id)}${COIN}`, () => App.sell(t.id)]);
    } else {
      const index = Number(anchor.dataset.index);
      const t = trickById(run.tricks[index]);
      html = `<h4>${t.icon} ${esc(t.name)}</h4><div class="rar">Фокус · одноразовый</div><p>${esc(t.desc)}</p>`;
      const usable = t.anytime ? t.can(null, run) : (m && m.canUseTrick(t.id));
      if (usable) acts.push([t.target === 'card' ? 'Выбрать карту' : 'Использовать', () => App.useTrick(index)]);
      else if (!t.anytime && !m) html += '<p class="muted">Используется во время партии, в свой ход.</p>';
      else html += '<p class="muted">Сейчас использовать нельзя.</p>';
    }
    tip.innerHTML = html + (acts.length ? '<div class="tip-actions"></div>' : '');
    const row = $('.tip-actions', tip);
    for (const [label, fn] of acts) {
      const b = h('button', 'btn small', label);
      b.addEventListener('click', (e) => { e.stopPropagation(); this.close(); fn(); });
      row.appendChild(b);
    }
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = Math.min(window.innerWidth - tw - 16, Math.max(16, r.left + r.width / 2 - tw / 2));
    let y = r.bottom + 10;
    if (y + th > window.innerHeight - 10) y = Math.max(10, r.top - th - 10);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  },
  close() {
    this.anchor = null;
    $('#tip').hidden = true;
  },
};

// ---------- состояние выбора ----------
const UI = {
  pendingDefend: null, // карта, для которой выбираем, что бить
  targeting: null,     // { index, id } — фокус ждёт выбора карты
  choiceFor: null,
};

// ---------- ход партии ----------
const Play = {
  match: null,
  busy: false,
  timer: null,
  autoTimer: null,
  slowNext: false,
  chasedThisBout: false,

  pace() { return Store.data.settings.fast ? 330 : 640; },

  start(match) {
    this.stop();
    this.match = match;
    this.busy = false;
    UI.pendingDefend = null;
    UI.targeting = null;
    Board.render({ deal: true });
    HUD.render();
    setTimeout(() => {
      if (this.match !== match) return;
      Fx.banner(match.g.attacker === 0 ? 'Твой ход первый' : `Первым ходит: ${match.opp.name}`);
    }, 500);
    this.slowNext = true;
    this.step();
  },

  stop() {
    clearTimeout(this.timer);
    clearTimeout(this.autoTimer);
    this.match = null;
    Board.hideChoice();
  },

  schedule(fn, ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(fn, ms);
  },

  step() {
    const m = this.match;
    if (!m) return;
    const g = m.g;
    clearTimeout(this.autoTimer);
    this.busy = g.over || g.actor() === 1;
    Board.render();
    HUD.render();
    this.updateStatus();
    if (g.over) {
      this.schedule(() => App.gameOver(), 1100);
      return;
    }
    if (g.actor() === 1) {
      const extra = this.slowNext ? 420 : 0;
      this.slowNext = false;
      this.schedule(() => this.aiMove(), this.pace() + extra);
      return;
    }
    this.autoMoves();
  },

  aiMove() {
    const m = this.match;
    if (!m || m.g.over) return;
    const g = m.g;
    let act = aiDecide(g, 1, m.opp.smart, m.rng);
    if (!act) act = g.canPass(1) ? { type: 'pass' } : g.canFinishTake(1) ? { type: 'finishTake' } : null;
    if (!aiApply(g, 1, act)) {
      const all = aiLegalActions(g, 1);
      if (all.length) aiApply(g, 1, all[all.length - 1]);
    }
    this.step();
  },

  // Подкинуть нечего — бито / пусть забирает, без лишних кликов.
  autoMoves() {
    const g = this.match.g;
    if (UI.targeting || g.actor() !== 0) return;
    if (g.legalAttacks(0).length) return;
    if (g.canFinishTake(0)) {
      this.autoTimer = setTimeout(() => {
        if (this.match && g.canFinishTake(0) && !UI.targeting && !g.legalAttacks(0).length) { g.finishTake(0); this.step(); }
      }, 700);
    } else if (g.canPass(0)) {
      this.autoTimer = setTimeout(() => {
        if (this.match && g.canPass(0) && !UI.targeting && !g.legalAttacks(0).length) { g.pass(0); this.step(); }
      }, 800);
    }
  },

  cardClick(id) {
    const m = this.match;
    if (!m) return;
    const g = m.g;
    Sfx.unlock();
    Tip.close();
    if (g.over || this.busy || g.actor() !== 0) return;
    const card = g.hands[0].find((c) => c.id === id);
    Board.hideChoice();

    if (UI.targeting) {
      if (!card) return;
      const { index } = UI.targeting;
      if (m.useTrick(index, card)) {
        UI.targeting = null;
        Sfx.play('magic');
        this.step();
      } else this.nope(id);
      return;
    }

    if (!card) {
      if (UI.pendingDefend != null) {
        const idx = g.table.findIndex((e) => e.a.id === id);
        if (idx >= 0 && g.defend(0, UI.pendingDefend, idx)) {
          UI.pendingDefend = null;
          this.step();
        }
      }
      return;
    }

    UI.pendingDefend = null;
    if (g.attacker === 0) {
      if (g.attack(0, id)) this.step(); else this.nope(id);
      return;
    }
    const targets = g.defendTargets(0, card);
    const canTr = g.canTransferWith(0, card);
    if (!targets.length && !canTr) { this.nope(id); return; }
    const beat = () => {
      if (targets.length === 1) { g.defend(0, id, targets[0]); this.step(); return; }
      UI.pendingDefend = id;
      Board.render();
      this.updateStatus();
    };
    const transfer = () => { g.transfer(0, id); this.step(); };
    if (canTr && targets.length) {
      Board.showChoice(card, beat, transfer);
      Board.render();
      return;
    }
    if (canTr) transfer(); else beat();
  },

  backgroundClick() {
    if (UI.pendingDefend != null || UI.choiceFor != null) {
      UI.pendingDefend = null;
      Board.hideChoice();
      Board.render();
      this.updateStatus();
    }
    Tip.close();
  },

  nope(id) {
    Sfx.play('nope');
    const e = Board.els.get(id);
    if (!e) return;
    e.classList.remove('nope');
    void e.offsetWidth;
    e.classList.add('nope');
    setTimeout(() => e.classList.remove('nope'), 400);
  },

  mainAction() {
    const m = this.match;
    if (!m) return;
    const g = m.g;
    Sfx.unlock();
    if (UI.targeting) { this.cancelTargeting(); return; }
    if (g.actor() !== 0 || this.busy) return;
    UI.pendingDefend = null;
    Board.hideChoice();
    if (g.canTake(0)) g.take(0);
    else if (g.canFinishTake(0)) g.finishTake(0);
    else if (g.canPass(0)) g.pass(0);
    else return;
    this.step();
  },

  cancelTargeting() {
    UI.targeting = null;
    this.step();
  },

  updateStatus() {
    const m = this.match;
    if (!m) return;
    const g = m.g;
    const st = $('#status');
    const btn = $('#btn-main');
    let text = '';
    let label = '';
    let pulse = false;
    const me = g.actor() === 0;
    if (g.over) {
      text = '';
    } else if (UI.targeting) {
      text = `Фокус «${trickById(UI.targeting.id).name}»: выбери карту в руке.`;
      label = 'Отмена';
    } else if (!me) {
      text = g.taking ? `${m.opp.name} подкидывает вдогонку…` : g.defender === 1 ? `${m.opp.name} думает, чем бить…` : `${m.opp.name} ходит…`;
    } else if (UI.pendingDefend != null) {
      text = 'Какую карту бьём? Нажми на неё на столе.';
    } else if (g.taking) {
      text = g.legalAttacks(0).length ? 'Соперник берёт. Подкинь вдогонку или нажми «Забирай».' : 'Подкинуть нечего.';
      label = 'Забирай';
    } else if (g.defender === 0) {
      const canBeat = g.hands[0].some((c) => g.defendTargets(0, c).length);
      const canTr = g.hands[0].some((c) => g.canTransferWith(0, c));
      text = canBeat || canTr ? `Отбивайся или бери.${canTr ? ' Можно перевести.' : ''}` : 'Нечем бить — придётся взять.';
      label = 'Беру';
      pulse = !canBeat && !canTr;
    } else if (g.table.length === 0) {
      text = 'Твой ход: ходи любой картой.';
    } else {
      text = g.legalAttacks(0).length ? 'Отбился. Подкинь карту того же достоинства или скажи «Бито».' : 'Подкинуть нечего — бито.';
      label = 'Бито';
    }
    st.textContent = text;
    st.classList.toggle('mine', me);
    btn.hidden = !label;
    btn.textContent = label;
    btn.classList.toggle('pulse', pulse);
    btn.classList.toggle('ghost', label === 'Отмена');
  },

  line(kind) {
    const own = this.match.opp.lines && this.match.opp.lines[kind];
    if (own && Math.random() < 0.6) return pickOne(own);
    return pickOne(LINES_COMMON[kind] || ['…']);
  },

  onEvent(type, ev) {
    const m = this.match;
    if (!m) return;
    switch (type) {
      case 'attack':
        Sfx.play('card');
        if (ev.who === 1 && ev.kind === 'chase' && !this.chasedThisBout) {
          this.chasedThisBout = true;
          if (Math.random() < 0.7) Board.say(this.line('chase'));
        }
        break;
      case 'defend':
        Sfx.play('card');
        break;
      case 'transfer':
        Sfx.play('card');
        Fx.banner('Переводной!');
        if (ev.who === 1) Board.say(this.line('transfer'));
        break;
      case 'take':
        if (ev.who === 1) Board.say(this.line('take'));
        break;
      case 'took':
        Sfx.play('take');
        this.chasedThisBout = false;
        this.slowNext = true;
        break;
      case 'bito':
        Sfx.play('bito');
        this.chasedThisBout = false;
        this.slowNext = true;
        if (ev.defender === 1 && Math.random() < 0.45) Board.say(this.line('bito'));
        else if (ev.defender === 0 && ev.attacker === 1 && Math.random() < 0.25) Board.say(this.line('pass'));
        break;
      case 'draw':
        Sfx.play('draw');
        break;
      case 'earn':
        if (m.g.over && !m.settledLive) break;
        Sfx.play('coin');
        Fx.wiggle(HUD.token(ev.source));
        Fx.floatAt(HUD.token(ev.source) || HUD.coins(), `+${ev.v}${COIN}`);
        break;
      case 'note':
        Fx.wiggle(HUD.token(ev.source));
        Fx.floatAt(HUD.token(ev.source) || $('#status'), ev.text, 'note');
        break;
      case 'peek':
        Fx.banner('Подсмотрел!');
        break;
      case 'heal':
        Fx.floatAt($('#topbar .hearts'), '+1 ♥', 'note');
        break;
      case 'over': {
        const out = m.outcome();
        if (out === 'win') Board.say(this.line('lose'));
        else if (out === 'lose') Board.say(this.line('win'));
        break;
      }
      default:
        break;
    }
  },
};

// ---------- приложение ----------
const App = {
  screen: 'menu',
  run: null,
  match: null,

  init(hot) {
    Store.load(hot);
    this.run = Store.data.run;
    Board.init();
    this.bind();
    this.renderMenu();
    this.show('menu');
    Platform.ready();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      try { window.claude.hot.snapshot(() => ({ save: Store.data })); } catch (e) { /* необязательно */ }
    }
  },

  bind() {
    document.addEventListener('pointerdown', () => Sfx.unlock(), { capture: true });
    $('#btn-main').addEventListener('click', (e) => { e.stopPropagation(); Play.mainAction(); });
    $('#topbar').addEventListener('click', (e) => {
      const tok = e.target.closest('.token, .trick');
      if (tok) { e.stopPropagation(); Sfx.play('click'); Tip.open(tok); return; }
      if (e.target.closest('#btn-pause')) { Sfx.play('click'); this.pause(); }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#tip') && !e.target.closest('.token, .trick')) Tip.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#modal').hidden && this.modalClosable) { this.closeModal(); return; }
        Tip.close();
        if (UI.targeting) Play.cancelTargeting(); else Play.backgroundClick();
      }
      if ((e.key === ' ' || e.key === 'Enter') && this.screen === 'game' && $('#modal').hidden && !e.target.closest('button, .card')) {
        e.preventDefault();
        Play.mainAction();
      }
    });
    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        Tip.close();
        if (this.screen === 'game') { Board.layout(); Board.hideChoice(); Board.render({ instant: true }); }
      }, 80);
    });
  },

  show(name) {
    this.screen = name;
    for (const s of $$('.screen')) s.hidden = s.id !== `screen-${name}`;
    Tip.close();
    HUD.render();
    document.documentElement.style.setProperty('--back', this.backColor());
    if (name !== 'game') Play.stop();
  },

  backColor() {
    const id = (this.run && this.run.back) || Store.data.back;
    return (BACKS.find((b) => b.id === id) || BACKS[0]).color;
  },

  // ----- меню -----
  renderMenu() {
    const d = Store.data;
    const meta = d.meta;
    const unlocked = (b) => !b.unlock || b.unlock.check(meta);
    if (!unlocked(BACKS.find((b) => b.id === d.back) || BACKS[0])) d.back = 'red';
    const sel = BACKS.find((b) => b.id === d.back) || BACKS[0];
    const root = $('#screen-menu');
    root.innerHTML = `
      <div class="menu">
        <div class="fan" aria-hidden="true"></div>
        <h1 class="logo">Козырь в рукаве<span class="logo-sub">дурак-рогалик: девять столов, один шанс</span></h1>
        <div class="menu-btns">
          ${this.run ? '<button class="btn big" data-a="continue">Продолжить забег</button>' : ''}
          <button class="btn ${this.run ? 'ghost' : 'big'}" data-a="new">Новый забег</button>
          <button class="btn ghost" data-a="rules">Как играть</button>
        </div>
        <div>
          <div class="section-label" style="margin-bottom:10px">Рубашка колоды</div>
          <div class="backs">${BACKS.map((b) => `
            <button class="back-opt${b.id === sel.id ? ' on' : ''}${unlocked(b) ? '' : ' locked'}" data-back="${b.id}" style="--bc:${b.color}">
              <span class="mini"></span>${esc(b.name)}
            </button>`).join('')}
          </div>
        </div>
        <div class="back-desc" id="back-desc">${esc(sel.desc)}</div>
        <div class="menu-stats">Выиграно партий: ${meta.gamesWon} · пройдено забегов: ${meta.runsWon}</div>
        <button class="btn ghost small" data-a="sound">${d.settings.sound ? '🔊 Звук включён' : '🔇 Звук выключен'}</button>
      </div>`;
    const fan = $('.fan', root);
    const fanCards = [{ r: 6, s: 2 }, { r: 11, s: 1 }, { r: 14, s: 0 }, { r: 12, s: 3 }, { r: 13, s: 2 }];
    fanCards.forEach((c, i) => {
      const e = cardEl({ ...c, id: -1 - i });
      const rot = (i - 2) * 11;
      e.style.transform = `translate(${115 + (i - 2) * 34}px, ${Math.abs(i - 2) * 7 + 12}px) rotate(${rot}deg)`;
      e.style.zIndex = i;
      fan.appendChild(e);
    });
    root.onclick = (e) => {
      const b = e.target.closest('[data-a], [data-back]');
      if (!b) return;
      Sfx.unlock();
      Sfx.play('click');
      if (b.dataset.back) {
        const back = BACKS.find((x) => x.id === b.dataset.back);
        if (unlocked(back)) {
          d.back = back.id;
          Store.save();
          this.renderMenu();
        } else {
          $('#back-desc').textContent = `Закрыто. ${back.unlock.text}, чтобы открыть: ${back.desc}`;
        }
        return;
      }
      const a = b.dataset.a;
      if (a === 'continue') this.resume();
      if (a === 'new') {
        if (this.run) {
          this.confirm('Начать новый забег?', 'Текущий забег пропадёт вместе с монетами и талисманами.', 'Начать заново', () => this.newRun());
        } else this.newRun();
      }
      if (a === 'rules') this.rules();
      if (a === 'sound') { d.settings.sound = !d.settings.sound; Store.save(); this.renderMenu(); }
    };
  },

  newRun() {
    const d = Store.data;
    this.run = newRun(d.back);
    this.run.phase = 'intro';
    d.run = this.run;
    d.meta.runsPlayed++;
    Store.save();
    this.renderIntro();
    this.show('intro');
  },

  resume() {
    if (!this.run) return;
    if (this.run.phase === 'shop' && this.run.shop) { this.renderShop(); this.show('shop'); }
    else { this.renderIntro(); this.show('intro'); }
  },

  // ----- перед столом -----
  renderIntro() {
    const run = this.run;
    const info = tableInfo(run.table);
    const opp = info.opp;
    const stars = Math.max(1, Math.round(opp.smart * 5));
    const hello = (opp.lines && opp.lines.hello && opp.lines.hello[0]) || 'Ну что, сыграем?';
    const stops = info.actInfo.tables.map((t, i) => {
      const cls = i < info.pos ? 'done' : i === info.pos ? 'now' : '';
      return `${i ? '<div class="link"></div>' : ''}<div class="stop ${cls}"><div class="portrait${t.boss ? ' boss' : ''}">${t.icon}</div><div class="nm">${esc(t.name)}</div><div class="tag">${t.boss ? 'босс' : ''}</div></div>`;
    }).join('');
    $('#screen-intro').innerHTML = `
      <div class="wrap">
        <div class="act-head">
          <div class="eyebrow">Акт ${ROMAN[info.act]} из ${ACTS.length}</div>
          <h1 class="act-title">${esc(info.actInfo.name)}</h1>
          <div class="act-sub">${esc(info.actInfo.sub)}</div>
        </div>
        <div class="path">${stops}</div>
        <div class="opp-card">
          <div class="portrait${opp.boss ? ' boss' : ''}">${opp.icon}</div>
          <div>
            <h2>${esc(opp.name)}</h2>
            <div class="ttl">${esc(opp.title)}</div>
            <div class="say">«${esc(hello)}»</div>
            <div class="rule-box">${opp.rule ? `<b>Особое правило</b>${esc(opp.rule.text)}` : '<b>Без особых правил</b>Обычный подкидной дурак.'}</div>
            <div class="meta-line">
              <span>Награда <b>${opp.reward}${COIN}</b></span>
              <span>Мастерство <b>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</b></span>
              ${opp.boss ? '<span>За победу над боссом <b>+1 ♥</b></span>' : ''}
            </div>
          </div>
        </div>
        <div class="center-row">
          <button class="btn big" data-a="play">Сесть за стол</button>
        </div>
      </div>`;
    $('#screen-intro').onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      Sfx.unlock();
      Sfx.play('click');
      if (b.dataset.a === 'play') this.startTable();
    };
  },

  startTable() {
    const run = this.run;
    const info = tableInfo(run.table);
    run.phase = 'intro';
    Store.save();
    const played = run.stats.won + run.stats.lost + run.stats.draws;
    const seed = (run.seed + run.table * 7919 + played * 104729) >>> 0;
    this.match = new Match(run, info.opp, seed);
    this.match.listener = (type, ev) => Play.onEvent(type, ev);
    this.show('game');
    Board.reset(this.match);
    this.match.begin();
    Board.layout();
    Play.start(this.match);
    Platform.gameplayStart();
  },

  // ----- конец партии -----
  gameOver() {
    const m = this.match;
    if (!m || m.settled) return;
    m.settled = true;
    Platform.gameplayStop();
    const run = this.run;
    const meta = Store.data.meta;
    const info = tableInfo(run.table);
    const res = m.settle();
    const notes = [];
    run.coins += res.total;
    run.stats.coins += res.total;
    meta.gamesPlayed++;
    let next;
    if (res.out === 'win') {
      meta.gamesWon++;
      run.stats.won++;
      if (info.opp.boss) {
        if (run.hearts < run.maxHearts) { run.hearts++; notes.push({ label: 'Босс повержен', v: '+1 ♥' }); }
        meta.bestAct = Math.max(meta.bestAct, info.act + 1);
      }
      run.table++;
      if (run.table >= TOTAL_TABLES) next = 'victory';
      else {
        run.shop = { offers: rollShop(run), rerolls: 0 };
        run.phase = 'shop';
        next = 'shop';
      }
    } else if (res.out === 'lose') {
      run.stats.lost++;
      if (m.has('zhilet') && !run.armorActs.includes(info.act)) {
        run.armorActs.push(info.act);
        notes.push({ label: 'Бронежилет спас сердце', v: '0 ♥', minus: false });
      } else {
        run.hearts--;
        notes.push({ label: 'Проигрыш', v: '−1 ♥', minus: true });
      }
      run.phase = 'intro';
      next = run.hearts <= 0 ? 'defeat' : 'retry';
    } else {
      run.stats.draws++;
      run.phase = 'intro';
      next = 'retry';
    }
    Store.save();
    HUD.render();

    const g = m.g;
    let title;
    let sub;
    let cls = '';
    if (res.out === 'win') {
      title = g.result === 'draw' ? 'Мировая!' : 'Победа!';
      sub = g.result === 'draw' ? 'Ничья — но по «Мировой» засчитана победа.' : `${info.opp.name} остаётся в дураках: ${cardsWord(g.hands[1].length)} на руках.`;
      Sfx.play('win');
    } else if (res.out === 'lose') {
      title = 'Ты — дурак!';
      sub = `На руках осталось: ${cardsWord(g.hands[0].length)}.`;
      cls = 'lose';
      Sfx.play('lose');
    } else {
      title = 'Ничья';
      sub = 'Вышли одновременно. Переигрываем без потерь.';
    }
    const btn = {
      shop: 'В барахолку',
      victory: 'Итоги забега',
      retry: res.out === 'draw' ? 'Переиграть' : 'Ещё раз',
      defeat: 'Итоги забега',
    }[next];
    const rows = res.lines.map((l) => ({ label: l.label, v: `+${l.v}`, coin: true })).concat(notes);
    this.modal(`
      <div class="sheet">
        <h2 class="${cls}">${esc(title)}</h2>
        <div class="sub">${esc(sub)}</div>
        <div class="tally"></div>
        ${res.total ? `<div class="tally-total" hidden><span>Итого</span><span>+${res.total}${COIN}</span></div>` : ''}
        <div class="sheet-actions"><button class="btn" data-a="next" hidden>${btn}</button></div>
      </div>`, false);
    const tally = $('#modal .tally');
    const step = reducedMotion() ? 0 : 320;
    rows.forEach((r, i) => {
      setTimeout(() => {
        const row = h('div', `tally-row${r.minus ? ' minus' : ''}`, `<span>${esc(r.label)}</span><span class="v">${esc(r.v)}${r.coin ? COIN : ''}</span>`);
        tally.appendChild(row);
        if (r.coin) Sfx.play('coin');
      }, 250 + i * step);
    });
    setTimeout(() => {
      const t = $('#modal .tally-total');
      if (t) t.hidden = false;
      const b = $('#modal [data-a="next"]');
      if (b) { b.hidden = false; b.focus(); }
    }, 300 + rows.length * step);
    $('#modal').onclick = (e) => {
      if (!e.target.closest('[data-a="next"]')) return;
      Sfx.play('click');
      this.closeModal();
      if (next === 'shop') { this.renderShop(); this.show('shop'); }
      else if (next === 'retry') { this.renderIntro(); this.show('intro'); }
      else this.endRun(next === 'victory');
    };
  },

  // ----- барахолка -----
  renderShop() {
    const run = this.run;
    const shop = run.shop;
    const rerollCost = 2 + shop.rerolls;
    const next = tableInfo(run.table);
    const offerHTML = shop.offers.map((o, i) => {
      const def = o.kind === 'talisman' ? talismanById(o.id) : trickById(o.id);
      const price = def.price;
      const full = o.kind === 'talisman' ? run.talismans.length >= run.talismanSlots : run.tricks.length >= run.trickSlots;
      const can = !o.sold && run.coins >= price && !full;
      const icon = o.kind === 'talisman'
        ? `<span class="token q${def.rarity}">${def.icon}</span>`
        : `<span class="trick">${def.icon}</span>`;
      const kind = o.kind === 'talisman' ? `Талисман · ${RARITY[def.rarity].name}` : 'Фокус · одноразовый';
      const why = o.sold ? '' : full ? (o.kind === 'talisman' ? 'Нет места — продай талисман' : 'Нет места для фокусов') : run.coins < price ? 'Не хватает монет' : '';
      return `
        <div class="offer${o.sold ? ' sold' : ''}">
          ${o.sold ? '<span class="stamp">Куплено</span>' : ''}
          <div class="ico">${icon}<div><h3>${esc(def.name)}</h3><div class="kind${o.kind === 'talisman' ? ` q${def.rarity}` : ''}">${kind}</div></div></div>
          <p>${esc(def.desc)}</p>
          <div class="buy-row">
            <span class="price-tag">${price}${COIN}</span>
            ${o.sold ? '' : `<button class="btn small" data-buy="${i}" ${can ? '' : 'disabled'} title="${esc(why)}">Купить</button>`}
          </div>
          ${why ? `<div class="muted">${esc(why)}</div>` : ''}
        </div>`;
    }).join('');
    const owned = run.talismans.length
      ? run.talismans.map((id) => {
        const t = talismanById(id);
        return `<div class="owned-item"><span class="token q${t.rarity}" style="cursor:default">${t.icon}</span><span>${esc(t.name)}</span><button class="btn small ghost" data-sell="${id}">Продать за ${sellPrice(id)}${COIN}</button></div>`;
      }).join('')
      : '<div class="muted">Пока пусто. Талисманы работают всю игру — начни с них.</div>';
    $('#screen-shop').innerHTML = `
      <div class="wrap">
        <div class="shop-head">
          <div>
            <div class="eyebrow">Между столами</div>
            <h2>Барахолка</h2>
            <div class="act-sub">у метро, по выходным. Торг неуместен.</div>
          </div>
          <div class="muted">Следующий стол: <b style="color:var(--cream)">${next.opp.icon} ${esc(next.opp.name)}</b>${next.opp.boss ? ' · босс' : ''}</div>
        </div>
        <div class="offers">${offerHTML}</div>
        <div class="owned">
          <div class="section-label">Твои талисманы · ${run.talismans.length}/${run.talismanSlots}</div>
          <div class="owned-list">${owned}</div>
        </div>
        <div class="shop-actions">
          <button class="btn ghost" data-a="reroll" ${run.coins >= rerollCost ? '' : 'disabled'}>Перемешать товар — ${rerollCost}${COIN}</button>
          <button class="btn big" data-a="leave">К следующему столу</button>
        </div>
      </div>`;
    $('#screen-shop').onclick = (e) => {
      const b = e.target.closest('[data-buy], [data-sell], [data-a]');
      if (!b || b.disabled) return;
      Sfx.unlock();
      if (b.dataset.buy != null) this.buy(Number(b.dataset.buy));
      else if (b.dataset.sell) this.sell(b.dataset.sell);
      else if (b.dataset.a === 'reroll') this.reroll();
      else if (b.dataset.a === 'leave') this.leaveShop();
    };
  },

  buy(i) {
    const run = this.run;
    const o = run.shop.offers[i];
    if (!o || o.sold) return;
    const price = priceOf(o);
    if (run.coins < price) return;
    if (o.kind === 'talisman') {
      if (run.talismans.length >= run.talismanSlots) return;
      run.talismans.push(o.id);
    } else {
      if (run.tricks.length >= run.trickSlots) return;
      run.tricks.push(o.id);
    }
    run.coins -= price;
    o.sold = true;
    Sfx.play('buy');
    Store.save();
    this.renderShop();
    HUD.render();
    Fx.wiggle(o.kind === 'talisman' ? HUD.token(o.id) : $('#topbar .trick:last-of-type'));
  },

  sell(id) {
    const run = this.run;
    const i = run.talismans.indexOf(id);
    if (i < 0 || this.screen !== 'shop') return;
    run.talismans.splice(i, 1);
    run.coins += sellPrice(id);
    Sfx.play('coin');
    Store.save();
    this.renderShop();
    HUD.render();
  },

  reroll() {
    const run = this.run;
    const cost = 2 + run.shop.rerolls;
    if (run.coins < cost) return;
    run.coins -= cost;
    run.shop.rerolls++;
    run.shop.offers = rollShop(run);
    Sfx.play('card');
    Store.save();
    this.renderShop();
    HUD.render();
  },

  leaveShop() {
    Sfx.play('click');
    this.run.shop = null;
    this.run.phase = 'intro';
    Store.save();
    this.renderIntro();
    this.show('intro');
  },

  // ----- фокусы -----
  useTrick(index) {
    const run = this.run;
    const t = trickById(run.tricks[index]);
    if (!t) return;
    if (t.anytime) {
      if (this.screen === 'game' && this.match) { this.match.useTrick(index); Play.step(); }
      else {
        if (!t.can(null, run)) return;
        run.tricks.splice(index, 1);
        run.hearts = Math.min(run.maxHearts, run.hearts + 1);
        Store.save();
        HUD.render();
        Fx.floatAt($('#topbar .hearts'), '+1 ♥', 'note');
      }
      Sfx.play('magic');
      return;
    }
    if (this.screen !== 'game' || !this.match) return;
    if (t.target === 'card') {
      UI.pendingDefend = null;
      Board.hideChoice();
      UI.targeting = { index, id: t.id };
      Play.step();
      return;
    }
    if (this.match.useTrick(index)) { Sfx.play('magic'); Play.step(); }
  },

  // ----- конец забега -----
  endRun(victory) {
    const d = Store.data;
    const run = this.run;
    const meta = d.meta;
    const before = BACKS.filter((b) => b.unlock && b.unlock.check(meta)).map((b) => b.id);
    if (victory) { meta.runsWon++; meta.bestAct = Math.max(meta.bestAct, ACTS.length); }
    const after = BACKS.filter((b) => b.unlock && b.unlock.check(meta));
    meta.seen = meta.seen || [];
    const newly = after.filter((b) => !meta.seen.includes(b.id));
    for (const b of newly) meta.seen.push(b.id);
    void before;
    d.run = null;
    Store.save();
    const info = tableInfo(Math.min(run.table, TOTAL_TABLES - 1));
    const talis = run.talismans.map((id) => talismanById(id)).map((t) => `${t.icon} ${esc(t.name)}`).join(', ') || 'ни одного';
    $('#screen-end').innerHTML = `
      <div class="end-wrap">
        <div class="eyebrow">${victory ? 'Хозяин признал поражение' : `Дошёл до акта ${ROMAN[info.act]}: ${esc(info.actInfo.name)}`}</div>
        <h1 class="act-title">${victory ? 'Забег пройден!' : 'Забег окончен'}</h1>
        <div class="sheet" style="text-align:left">
          <div class="tally">
            <div class="tally-row"><span>Выиграно партий</span><span class="v">${run.stats.won}</span></div>
            <div class="tally-row"><span>Проиграно</span><span class="v">${run.stats.lost}</span></div>
            <div class="tally-row"><span>Ничьих</span><span class="v">${run.stats.draws}</span></div>
            <div class="tally-row"><span>Заработано монет</span><span class="v">${run.stats.coins}${COIN}</span></div>
          </div>
          <div class="sub" style="margin-top:10px">Талисманы: ${talis}</div>
        </div>
        ${newly.map((b) => `<div class="unlock">Открыта рубашка «${esc(b.name)}»: ${esc(b.desc)}</div>`).join('')}
        <button class="btn big" data-a="menu">В меню</button>
      </div>`;
    $('#screen-end').onclick = (e) => {
      if (!e.target.closest('[data-a="menu"]')) return;
      Sfx.play('click');
      this.run = null;
      this.match = null;
      this.renderMenu();
      this.show('menu');
    };
    this.run = null;
    this.show('end');
    if (victory) Sfx.play('win');
  },

  // ----- окна -----
  modalClosable: true,
  modal(html, closable = true) {
    const m = $('#modal');
    m.innerHTML = html;
    m.hidden = false;
    this.modalClosable = closable;
    m.onclick = closable ? (e) => { if (e.target === m) this.closeModal(); } : null;
  },
  closeModal() {
    const m = $('#modal');
    m.hidden = true;
    m.innerHTML = '';
    m.onclick = null;
  },

  confirm(title, text, okLabel, onOk) {
    this.modal(`
      <div class="panel" style="width:min(400px,100%)">
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        <div class="row"><button class="btn" data-a="ok">${esc(okLabel)}</button><button class="btn ghost" data-a="cancel">Отмена</button></div>
      </div>`);
    $('#modal .panel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      Sfx.play('click');
      this.closeModal();
      if (b.dataset.a === 'ok') onOk();
    });
  },

  pause() {
    const s = Store.data.settings;
    const inGame = this.screen === 'game';
    this.modal(`
      <div class="panel" style="width:min(380px,100%)">
        <h2>Пауза</h2>
        <div class="stack-btns">
          <button class="btn" data-a="back">Вернуться</button>
          <button class="btn ghost" data-a="rules">Как играть</button>
          <button class="btn ghost" data-a="sound">${s.sound ? '🔊 Звук: вкл' : '🔇 Звук: выкл'}</button>
          <button class="btn ghost" data-a="fast">${s.fast ? '⏩ Соперник ходит быстро' : '▶ Соперник ходит не спеша'}</button>
          <button class="btn ghost" data-a="menu">Выйти в меню</button>
        </div>
        ${inGame ? '<p class="muted" style="margin-top:14px">Забег сохраняется. Начатая партия при выходе не засчитывается — стол начнётся заново.</p>' : '<p class="muted" style="margin-top:14px">Забег сохраняется автоматически.</p>'}
      </div>`);
    $('#modal .panel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      Sfx.play('click');
      const a = b.dataset.a;
      if (a === 'back') this.closeModal();
      if (a === 'rules') this.rules();
      if (a === 'sound') { s.sound = !s.sound; Store.save(); this.pause(); }
      if (a === 'fast') { s.fast = !s.fast; Store.save(); this.pause(); }
      if (a === 'menu') {
        this.closeModal();
        Play.stop();
        this.match = null;
        this.renderMenu();
        this.show('menu');
      }
    });
  },

  rules() {
    this.modal(`
      <div class="panel">
        <h2>Как играть</h2>
        <h3>Подкидной дурак</h3>
        <ul>
          <li>Колода — 36 карт, от шестёрки до туза (Т). Козырь — масть открытой карты под колодой. У каждого по 6 карт.</li>
          <li>Атакующий ходит любой картой. Отбиться можно старшей картой той же масти или козырем.</li>
          <li>Когда всё отбито, атакующий может подкинуть карту того же достоинства, что уже лежит на столе. В отбое не больше 6 карт (в первом — 5) и не больше, чем у отбивающегося на руках.</li>
          <li>Отбился — «Бито»: карты уходят, ход переходит к тебе. Нечем бить — «Беру»: забираешь всё со стола, а соперник ещё подкинет вдогонку.</li>
          <li>После каждого отбоя все добирают до шести, первым — тот, кто ходил.</li>
          <li>Колода кончилась — кто первым избавился от карт, тот выиграл. Последний с картами — дурак.</li>
        </ul>
        <h3>Забег</h3>
        <ul>
          <li>Три акта по три соперника. Третий в акте — босс: у каждого босса своё правило, а за победу над ним — сердце.</li>
          <li>Победа приносит монеты. Проиграл — теряешь сердце и переигрываешь стол. Ничья — переигровка без потерь. Сердца кончились — забег окончен.</li>
          <li>Между столами — барахолка. <b>Талисманы</b> действуют всегда, <b>фокусы</b> — разовые хитрости, их применяют в свой ход.</li>
          <li>Новые рубашки колоды открываются за успехи и меняют начало забега.</li>
        </ul>
        <h3>Управление</h3>
        <ul>
          <li>Нажми на карту в руке, чтобы сыграть ею. Карты, которыми сейчас можно ходить, подсвечены; козыри — с золотой каймой.</li>
          <li>Пробел или кнопка над рукой — «Бито», «Беру» или «Забирай». Нажми на талисман или фокус наверху, чтобы прочитать и применить.</li>
        </ul>
        <div class="row"><button class="btn" data-a="close">Понятно</button></div>
      </div>`);
    $('#modal .panel').addEventListener('click', (e) => {
      if (e.target.closest('[data-a="close"]')) { Sfx.play('click'); this.closeModal(); }
    });
  },
};

function boot(hotData) {
  App.init(hotData || {});
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
