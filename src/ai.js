// ===== Соперник =====
// smart: 0..1 — насколько хорошо играет (бережёт козыри, вовремя берёт, реже ошибается).

function aiValue(g, c, who) {
  let v = c.r;
  if (g.isTrump(c, who)) v += 12;
  if (c.wild) v += 30;
  return v;
}

function aiPlanDefense(g, me) {
  const open = [];
  g.table.forEach((e, i) => { if (!e.d) open.push(i); });
  open.sort((i, j) => aiValue(g, g.table[j].a, g.table[j].by) - aiValue(g, g.table[i].a, g.table[i].by));
  const used = new Set();
  const plan = [];
  for (const i of open) {
    const e = g.table[i];
    let best = null;
    let bestV = Infinity;
    for (const c of g.hands[me]) {
      if (used.has(c.id) || !g.canBeat(e.a, e.by, c, me)) continue;
      const v = aiValue(g, c, me);
      if (v < bestV) { bestV = v; best = c; }
    }
    if (!best) return null;
    used.add(best.id);
    plan.push({ card: best, target: i, v: bestV });
  }
  return plan;
}

function aiLegalActions(g, me) {
  const acts = [];
  if (g.actor() !== me) return acts;
  if (g.taking) {
    for (const c of g.legalAttacks(me)) acts.push({ type: 'attack', id: c.id });
    acts.push({ type: 'finishTake' });
  } else if (me === g.defender && g.hasUnbeaten()) {
    for (const c of g.hands[me]) {
      for (const t of g.defendTargets(me, c)) acts.push({ type: 'defend', id: c.id, target: t });
      if (g.canTransferWith(me, c)) acts.push({ type: 'transfer', id: c.id });
    }
    acts.push({ type: 'take' });
  } else {
    for (const c of g.legalAttacks(me)) acts.push({ type: 'attack', id: c.id });
    if (g.canPass(me)) acts.push({ type: 'pass' });
  }
  return acts;
}

function aiDecide(g, me, smart, rng) {
  const opp = 1 - me;
  const deckLeft = g.deck.length;
  const hand = g.hands[me];
  const val = (c) => aiValue(g, c, me);
  const lowest = (cards) => cards.reduce((a, b) => (val(b) < val(a) ? b : a));

  // Иногда соперник ошибается — тем чаще, чем он проще.
  if (rng() < (1 - smart) * 0.45) {
    const acts = aiLegalActions(g, me).filter((a) => !(a.type === 'take' && deckLeft === 0 && aiPlanDefense(g, me)));
    if (acts.length) return acts[Math.floor(rng() * acts.length)];
  }

  // Соперник берёт — подкидываем вдогонку.
  if (g.taking) {
    const legal = g.legalAttacks(me);
    const good = legal.filter((c) => {
      if (g.isTrump(c, me)) return deckLeft === 0 && c.r <= 9;
      return deckLeft === 0 || c.r <= (smart > 0.6 ? 11 : 13);
    });
    return good.length ? { type: 'attack', id: lowest(good).id } : { type: 'finishTake' };
  }

  // Защита.
  if (me === g.defender && g.hasUnbeaten()) {
    const plan = aiPlanDefense(g, me);
    const transfers = hand.filter((c) => g.canTransferWith(me, c));
    if (transfers.length) {
      const t = lowest(transfers);
      const cheapest = plan ? Math.min(...plan.map((p) => p.v)) : Infinity;
      if (!g.isTrump(t, me) || !plan || deckLeft === 0) {
        if (val(t) <= cheapest + 3) return { type: 'transfer', id: t.id };
      }
    }
    if (!plan) return { type: 'take' };
    if (deckLeft >= 8 && smart >= 0.45) {
      const bigTrump = plan.some((p) => g.isTrump(p.card, me) && p.card.r >= 12);
      const cheapTable = g.table.length <= 2 && g.table.every((e) => aiValue(g, e.a, e.by) <= 9);
      if (bigTrump && cheapTable && rng() < smart * 0.75) return { type: 'take' };
    }
    return { type: 'defend', id: plan[0].card.id, target: plan[0].target };
  }

  // Атака.
  const legal = g.legalAttacks(me);
  if (g.table.length === 0) {
    if (!legal.length) return null;
    const counts = {};
    for (const c of hand) counts[c.r] = (counts[c.r] || 0) + 1;
    const allTrumps = hand.every((c) => g.isTrump(c, me));
    let score = (c) => val(c) - (counts[c.r] - 1) * 2.5 + (g.isTrump(c, me) && !allTrumps ? 6 : 0);
    if (deckLeft === 0 && smart > 0.55 && g.hands[opp].length <= 2) {
      // Под конец бьём самой сильной — пусть попробует отбиться.
      score = (c) => -val(c) - (counts[c.r] - 1) * 3;
    }
    return { type: 'attack', id: legal.reduce((a, b) => (score(b) < score(a) ? b : a)).id };
  }

  // Всё отбито — подкидываем или «бито».
  const cap = deckLeft > 12 ? 10 : deckLeft > 4 ? 12 : 14;
  const good = legal.filter((c) => {
    if (deckLeft === 0) return !g.isTrump(c, me) || c.r <= 11 || hand.length <= 2;
    return !g.isTrump(c, me) && c.r <= cap;
  });
  if (good.length && (smart > 0.3 || rng() < 0.7)) return { type: 'attack', id: lowest(good).id };
  return g.canPass(me) ? { type: 'pass' } : null;
}

function aiApply(g, me, act) {
  if (!act) return false;
  switch (act.type) {
    case 'attack': return g.attack(me, act.id);
    case 'defend': return g.defend(me, act.id, act.target);
    case 'transfer': return g.transfer(me, act.id);
    case 'take': return g.take(me);
    case 'pass': return g.pass(me);
    case 'finishTake': return g.finishTake(me);
    default: return false;
  }
}
