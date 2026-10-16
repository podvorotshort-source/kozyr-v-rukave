// Прогон партий ИИ против ИИ: целостность колоды, завершение партий, баланс.
// Запуск: node tests/sim.js [кол-во партий]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Error };
vm.createContext(ctx);
for (const f of ['engine.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('this.API = { DurakGame, defaultRules, mulberry32, aiDecide, aiApply, aiLegalActions };', ctx);
const { DurakGame, defaultRules, mulberry32, aiDecide, aiApply, aiLegalActions } = ctx.API;

const N = Number(process.argv[2] || 4000);
const flags = ['transfer', 'sixBeatsAce', 'queenSpades', 'jacksTrump', 'doubleTrump', 'neighborThrow', 'freeThrowOnTake'];

function randomRules(rng) {
  const r = defaultRules();
  if (rng() < 0.2) r.minRank = 9;
  for (const p of [0, 1]) {
    for (const f of flags) if (rng() < 0.15) r[f][p] = true;
    if (rng() < 0.12) r.handSize[p] = 7;
    if (rng() < 0.08) r.handSize[p] = 5;
  }
  if (rng() < 0.15) r.firstAttacker = rng() < 0.5 ? 0 : 1;
  return r;
}

function play(seed, opts) {
  const rng = mulberry32(seed);
  const rules = opts.randomRules ? randomRules(rng) : defaultRules();
  const g = new DurakGame(rules, rng);
  g.setup();
  g.start();
  g.checkIntegrity();
  let steps = 0;
  while (!g.over) {
    if (++steps > 2000) throw new Error(`партия не закончилась (seed ${seed})`);
    const me = g.actor();
    let act;
    if (opts.random && me === 0) {
      const acts = aiLegalActions(g, me);
      act = acts[Math.floor(rng() * acts.length)];
    } else {
      act = aiDecide(g, me, opts.smart[me], rng);
    }
    if (!act) {
      // Нечего делать: подкинуть нечего — бито / пусть берёт.
      if (g.canPass(me)) act = { type: 'pass' };
      else if (g.canFinishTake(me)) act = { type: 'finishTake' };
    }
    if (!aiApply(g, me, act)) {
      throw new Error(`недопустимый ход ${JSON.stringify(act)} (seed ${seed}, шаг ${steps})`);
    }
    g.checkIntegrity();
  }
  return { result: g.result, steps, bouts: g.boutNo };
}

function batch(label, opts) {
  const res = { win: 0, lose: 0, draw: 0 };
  let steps = 0;
  let bouts = 0;
  for (let i = 0; i < N; i++) {
    const r = play(1000 + i, opts);
    res[r.result]++;
    steps += r.steps;
    bouts += r.bouts;
  }
  const pct = (x) => ((x / N) * 100).toFixed(1) + '%';
  console.log(`${label.padEnd(44)} побед игрока 0: ${pct(res.win)}  поражений: ${pct(res.lose)}  ничьих: ${pct(res.draw)}  (~${(bouts / N).toFixed(1)} отбоев)`);
}

batch('обычные правила, ум 0.5 vs 0.5', { smart: [0.5, 0.5] });
batch('случайные правила, ум 0.5 vs 0.5', { smart: [0.5, 0.5], randomRules: true });
batch('случайные ходы vs ум 0.25', { smart: [0, 0.25], random: true, randomRules: true });
batch('ум 0.9 vs ум 0.25', { smart: [0.9, 0.25] });
batch('ум 0.9 vs ум 0.6', { smart: [0.9, 0.6] });
batch('ум 0.9 vs ум 0.9', { smart: [0.9, 0.9] });
console.log('OK: все партии завершились, карты не терялись.');
