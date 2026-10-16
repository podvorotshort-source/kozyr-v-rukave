// Баланс: как часто «сильный игрок» (ИИ с умом 0.85 за игрока 0) обыгрывает каждого соперника.
// Запуск: node tests/balance.js [партий на стол]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Error, Date, JSON, localStorage: undefined };
vm.createContext(ctx);
for (const f of ['engine.js', 'ai.js', 'content.js', 'run.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('this.API = { ACTS, Match, aiDecide, aiApply, TALISMANS };', ctx);
const { ACTS, Match, aiDecide, aiApply, TALISMANS } = ctx.API;

const N = Number(process.argv[2] || 1500);
const PLAYER_SMART = 0.85;

function playOnce(opp, talismans, seed) {
  const run = { talismans, tricks: [], hearts: 3, maxHearts: 3, coins: 10 };
  const m = new Match(run, opp, seed);
  m.begin();
  const g = m.g;
  let steps = 0;
  while (!g.over) {
    if (++steps > 3000) throw new Error('зависла партия');
    const me = g.actor();
    let act = aiDecide(g, me, me === 0 ? PLAYER_SMART : opp.smart, m.rng);
    if (!act) act = g.canPass(me) ? { type: 'pass' } : { type: 'finishTake' };
    if (!aiApply(g, me, act)) throw new Error(`недопустимый ход ${JSON.stringify(act)}`);
    g.checkIntegrity();
  }
  const s = m.settle();
  return { out: s.out, coins: s.total };
}

function rate(opp, talismans) {
  let win = 0, draw = 0, coins = 0;
  for (let i = 0; i < N; i++) {
    const r = playOnce(opp, talismans, 7 + i * 31);
    if (r.out === 'win') { win++; coins += r.coins; }
    if (r.out === 'draw') draw++;
  }
  return { win: win / N, draw: draw / N, coins: win ? coins / win : 0 };
}

const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
console.log(`Сильный игрок (ум ${PLAYER_SMART}), ${N} партий на стол\n`);
const builds = [
  ['без талисманов', []],
  ['оборона+копилка', ['oborona', 'kopilka']],
  ['переводной+соседи+вдогонку', ['perevod', 'sosedi', 'vdogonku']],
  ['двойной козырь', ['dvoynoy']],
];
for (const act of ACTS) {
  for (const opp of act.tables) {
    const cells = builds.map(([, t]) => { const r = rate(opp, t); return `${pct(r.win)} (${pct(r.draw)} ничьих, ~${r.coins.toFixed(1)} мон.)`; });
    console.log(`${(act.name + ' · ' + opp.name).padEnd(36)} ${cells.join(' | ')}`);
  }
}
console.log(`\nСтолбцы: ${builds.map((b) => b[0]).join(' | ')}`);
for (const t of TALISMANS) {
  const r = rate(ACTS[1].tables[0], [t.id]);
  console.log(`  ${t.name.padEnd(22)} против Кости: ${pct(r.win)}`);
}
