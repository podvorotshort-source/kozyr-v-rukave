// Симуляция целых забегов: сколько процентов игроков проходит все девять столов.
// Запуск: node tests/runsim.js [забегов] [ум игрока]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Error, Date, JSON };
vm.createContext(ctx);
for (const f of ['engine.js', 'ai.js', 'content.js', 'run.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('this.API = { Match, aiDecide, aiApply, newRun, tableInfo, rollShop, priceOf, TOTAL_TABLES, mulberry32, talismanById };', ctx);
const { Match, aiDecide, aiApply, newRun, tableInfo, rollShop, priceOf, TOTAL_TABLES, mulberry32, talismanById } = ctx.API;

const RUNS = Number(process.argv[2] || 300);
const P = Number(process.argv[3] || 0.75);
const PREF = ['dvoynoy', 'sosedi', 'mirovaya', 'ruki', 'valet', 'vdogonku', 'zhilet', 'perviy', 'oborona', 'karman',
  'kopilka', 'sberkniga', 'zoloto', 'pogony', 'tuz', 'perevod', 'shesterka', 'dama', 'karmannik', 'pamyat', 'glaz'];

function playTable(run, opp, seed) {
  const m = new Match(run, opp, seed);
  m.begin();
  const g = m.g;
  while (!g.over) {
    const me = g.actor();
    let a = aiDecide(g, me, me === 0 ? P : opp.smart, m.rng);
    if (!a) a = g.canPass(me) ? { type: 'pass' } : { type: 'finishTake' };
    aiApply(g, me, a);
  }
  return m.settle();
}

function shop(run, rng) {
  const offers = rollShop(run, rng);
  const order = offers.filter((o) => o.kind === 'talisman').sort((a, b) => PREF.indexOf(a.id) - PREF.indexOf(b.id));
  for (const o of order) {
    if (PREF.indexOf(o.id) < 0) continue;
    if (run.talismans.length < run.talismanSlots && run.coins >= priceOf(o)) { run.coins -= priceOf(o); run.talismans.push(o.id); }
  }
  const validol = offers.find((o) => o.id === 'validol');
  if (validol && run.hearts < run.maxHearts && run.coins >= priceOf(validol)) { run.coins -= priceOf(validol); run.hearts++; }
}

const reached = new Array(TOTAL_TABLES + 1).fill(0);
let games = 0;
let wins = 0;
for (let r = 0; r < RUNS; r++) {
  const rng = mulberry32(1000 + r);
  const run = newRun('red');
  let played = 0;
  while (run.hearts > 0 && run.table < TOTAL_TABLES) {
    const info = tableInfo(run.table);
    const res = playTable(run, info.opp, 77 + r * 1009 + played * 13);
    played++;
    games++;
    run.coins += res.total;
    if (res.out === 'win') {
      wins++;
      if (info.opp.boss) run.hearts = Math.min(run.maxHearts, run.hearts + 1);
      run.table++;
      if (run.table < TOTAL_TABLES) shop(run, rng);
    } else if (res.out === 'lose') {
      if (run.talismans.includes('zhilet') && !run.armorActs.includes(info.act)) run.armorActs.push(info.act);
      else run.hearts--;
    }
  }
  reached[run.table]++;
}
console.log(`Игрок с умом ${P}, ${RUNS} забегов: пройдено целиком ${((reached[TOTAL_TABLES] / RUNS) * 100).toFixed(1)}%, побед в партиях ${((wins / games) * 100).toFixed(0)}%`);
const names = [];
for (let i = 0; i < TOTAL_TABLES; i++) names.push(tableInfo(i).opp.name);
console.log('Где закончились забеги:');
for (let i = 0; i < TOTAL_TABLES; i++) if (reached[i]) console.log(`  на столе ${i + 1} (${names[i]}): ${((reached[i] / RUNS) * 100).toFixed(1)}%`);
