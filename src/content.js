// ===== Талисманы, фокусы, соперники, рубашки =====

const RARITY = {
  1: { name: 'обычный', weight: 60 },
  2: { name: 'редкий', weight: 28 },
  3: { name: 'особый', weight: 10 },
  4: { name: 'легендарный', weight: 3 },
};

// Хуки талисманов получают fx — объект с earn(сумма, подпись) и доступом к партии.
const TALISMANS = [
  {
    id: 'oborona', name: 'Оборона', icon: '🛡️', rarity: 1, price: 4,
    desc: '+1 монета каждый раз, когда ты отбился.',
    on: { bito(fx, ev) { if (ev.defender === 0) fx.earn(1, 'Оборона'); } },
  },
  {
    id: 'kopilka', name: 'Копилка', icon: '🐷', rarity: 1, price: 4,
    desc: 'Победа: +1 монета за каждые две карты, оставшиеся у дурака.',
    on: { end(fx, g) { const n = Math.floor(g.hands[1].length / 2); if (fx.won && n) fx.earn(n, `Копилка (у дурака на руках: ${g.hands[1].length})`); } },
  },
  {
    id: 'karman', name: 'Бита в карман', icon: '💰', rarity: 1, price: 4,
    desc: '+1 монета каждый раз, когда соперник забирает карты.',
    on: { took(fx, ev) { if (ev.who === 1) fx.earn(1, 'Бита в карман'); } },
  },
  {
    id: 'pogony', name: 'Погоны', icon: '🎖️', rarity: 2, price: 5,
    desc: 'Победа: +3 монеты за каждую шестёрку, оставшуюся у дурака.',
    on: {
      end(fx, g) {
        const n = g.hands[1].filter((c) => c.r === 6).length;
        if (fx.won && n) fx.earn(3 * n, `Погоны: ${n} × шестёрка`);
      },
    },
  },
  {
    id: 'sberkniga', name: 'Сберкнижка', icon: '📒', rarity: 2, price: 5,
    desc: 'После победы: +1 монета за каждые 5 монет в кошельке (до +5).',
    on: { end(fx) { if (fx.won) { const n = Math.min(5, Math.floor(fx.run.coins / 5)); if (n) fx.earn(n, 'Сберкнижка: проценты'); } } },
  },
  {
    id: 'zoloto', name: 'Золотой козырь', icon: '👑', rarity: 2, price: 6,
    desc: '+1 монета за каждый твой козырь, ушедший в биту.',
    on: {
      bito(fx, ev, g) {
        let n = 0;
        for (const e of ev.entries) {
          if (e.by === 0 && g.isTrump(e.a, 0)) n++;
          if (e.d && e.dby === 0 && g.isTrump(e.d, 0)) n++;
        }
        if (n) fx.earn(n, 'Золотой козырь');
      },
    },
  },
  {
    id: 'shesterka', name: 'Шестёрка бьёт туза', icon: '6️⃣', rarity: 1, price: 4,
    desc: 'Твои шестёрки бьют тузов той же масти. По-дворовому.',
    rules(r) { r.sixBeatsAce[0] = true; },
  },
  {
    id: 'dama', name: 'Пиковая дама', icon: '🖤', rarity: 1, price: 4,
    desc: 'Твоя дама пик бьёт любую некозырную карту.',
    rules(r) { r.queenSpades[0] = true; },
  },
  {
    id: 'ruki', name: 'Щедрая рука', icon: '🖐️', rarity: 1, price: 4,
    desc: 'Соперник добирает до 7 карт вместо 6 — пусть помучается.',
    rules(r) { r.handSize[1] += 1; },
  },
  {
    id: 'sosedi', name: 'Соседи', icon: '🏘️', rarity: 3, price: 8,
    desc: 'Подкидывать можно и карты соседнего достоинства: к восьмёрке — семёрку и девятку.',
    rules(r) { r.neighborThrow[0] = true; },
  },
  {
    id: 'perevod', name: 'Переводной', icon: '🔄', rarity: 2, price: 6,
    desc: 'Можешь переводить: положи карту того же достоинства — и отбивается уже соперник.',
    rules(r) { r.transfer[0] = true; },
  },
  {
    id: 'valet', name: 'Валет-хамелеон', icon: '🎭', rarity: 2, price: 6,
    desc: 'Все твои валеты считаются козырями.',
    rules(r) { r.jacksTrump[0] = true; },
  },
  {
    id: 'vdogonku', name: 'Вдогонку', icon: '🏃', rarity: 3, price: 7,
    desc: 'Когда соперник берёт, подкидывай карты любого достоинства.',
    rules(r) { r.freeThrowOnTake[0] = true; },
  },
  {
    id: 'tuz', name: 'Туз в рукаве', icon: '🧥', rarity: 3, price: 7,
    desc: 'В начале партии у тебя на руках всегда есть туз.',
    deal(fx, g) {
      if (g.hands[0].some((c) => c.r === 14)) return;
      const pulled = g.pullFromDeck((c) => c.r === 14);
      if (!pulled) return;
      const worst = lowestCard(g, 0);
      const hi = g.hands[0].indexOf(worst);
      g.hands[0][hi] = pulled.card;
      g.deck[pulled.index] = worst;
      fx.note('Туз в рукаве');
    },
  },
  {
    id: 'karmannik', name: 'Карманник', icon: '🤏', rarity: 3, price: 7,
    desc: 'В начале партии твоя худшая карта меняется на случайную карту соперника.',
    deal(fx, g) {
      const mine = lowestCard(g, 0);
      const theirs = g.hands[1][Math.floor(g.rng() * g.hands[1].length)];
      const a = g.hands[0].indexOf(mine);
      const b = g.hands[1].indexOf(theirs);
      g.hands[0][a] = theirs;
      g.hands[1][b] = mine;
      g.known[1].add(mine.id);
      fx.note('Карманник');
    },
  },
  {
    id: 'dvoynoy', name: 'Двойной козырь', icon: '⭐', rarity: 4, price: 10,
    desc: 'Масть того же цвета, что и козырь, — тоже твой козырь.',
    rules(r) { r.doubleTrump[0] = true; },
  },
  {
    id: 'obmen', name: 'Козырная шестёрка', icon: '🔁', rarity: 1, price: 3, active: true,
    desc: 'Раз за партию: обменяй козырную шестёрку на открытый козырь под колодой.',
    canUse(g) {
      return g.deck.length >= 2 && g.hands[0].some((c) => c.r === 6 && c.s === g.trumpSuit);
    },
    use(fx, g) {
      const six = g.hands[0].find((c) => c.r === 6 && c.s === g.trumpSuit);
      const bottom = g.deck[0];
      g.hands[0][g.hands[0].indexOf(six)] = bottom;
      g.deck[0] = six;
      fx.note(`Обмен: забрал ${cardName(bottom)}`);
    },
  },
  {
    id: 'shuler', name: 'Шулерская пересдача', icon: '🎩', rarity: 2, price: 6, active: true,
    desc: 'Раз за партию: две твои худшие карты уходят в биту, а ты берёшь две из колоды.',
    canUse(g) { return g.deck.length >= 2 && g.hands[0].length >= 2; },
    use(fx, g) {
      for (let i = 0; i < 2; i++) g.moveToDiscard(0, lowestCard(g, 0).id);
      for (let i = 0; i < 2 && g.deck.length; i++) g.hands[0].push(g.deck.pop());
      fx.note('Пересдача');
    },
  },
  {
    id: 'pamyat', name: 'Хорошая память', icon: '🧠', rarity: 1, price: 4,
    desc: 'Карты, которые соперник забрал со стола, видны у него в руке.',
  },
  {
    id: 'glaz', name: 'Зоркий глаз', icon: '👁️', rarity: 1, price: 3,
    desc: 'Видишь верхнюю карту колоды.',
  },
  {
    id: 'mirovaya', name: 'Мировая', icon: '🤝', rarity: 1, price: 3,
    desc: 'Ничья засчитывается как победа.',
  },
  {
    id: 'perviy', name: 'Первый ход', icon: '🥇', rarity: 1, price: 3,
    desc: 'Ты всегда ходишь первым (если у соперника нет своих правил на этот счёт).',
    rules(r) { if (r.firstAttacker == null) r.firstAttacker = 0; },
  },
  {
    id: 'zhilet', name: 'Бронежилет', icon: '🦺', rarity: 3, price: 7,
    desc: 'Первое поражение в каждом акте не отнимает сердце.',
  },
];

// Фокусы — разовые карточки. target: 'card' — нужно выбрать карту в руке.
const TRICKS = [
  {
    id: 'podsmotr', name: 'Подсмотреть', icon: '👀', price: 3, target: null,
    desc: 'До конца отбоя видишь все карты соперника.',
    can: (g) => true,
    use(fx, g) { fx.peek(); },
  },
  {
    id: 'kraska', name: 'Перекраска', icon: '🎨', price: 4, target: 'card',
    desc: 'Выбранная карта становится козырной масти.',
    canCard: (g, c) => c.s !== g.trumpSuit,
    use(fx, g, c) { c.s = g.trumpSuit; c.painted = true; fx.note(`${RANK_LABEL[c.r]} теперь козырь`); },
  },
  {
    id: 'povysh', name: 'Повышение', icon: '⬆️', price: 3, target: 'card',
    desc: 'Выбранная карта получает +3 к достоинству (не выше туза).',
    canCard: (g, c) => c.r < 14,
    use(fx, g, c) { c.r = Math.min(14, c.r + 3); c.boosted = true; fx.note(`Повышение: ${cardName(c)}`); },
  },
  {
    id: 'vbitu', name: 'В биту!', icon: '🗑️', price: 5, target: 'card',
    desc: 'Выбранная карта уходит в биту. Последнюю карту так не сбросить.',
    can: (g) => g.hands[0].length >= 2,
    canCard: (g) => g.hands[0].length >= 2,
    use(fx, g, c) { g.moveToDiscard(0, c.id); fx.note('В биту!'); },
  },
  {
    id: 'podarok', name: 'Подарок', icon: '🎁', price: 6, target: 'card',
    desc: 'Отдай выбранную карту сопернику. Последнюю карту так не отдать.',
    can: (g) => g.hands[0].length >= 2,
    canCard: (g) => g.hands[0].length >= 2,
    use(fx, g, c) { g.give(0, c.id); fx.note('Подарок сопернику'); },
  },
  {
    id: 'smena', name: 'Смена козыря', icon: '🔀', price: 4, target: 'card',
    desc: 'Козырем становится масть выбранной карты — для обоих игроков.',
    canCard: (g, c) => c.s !== g.trumpSuit,
    use(fx, g, c) { g.trumpSuit = c.s; fx.note(`Козырь теперь ${SUIT_NAMES[c.s]}`); },
  },
  {
    id: 'krazha', name: 'Кража', icon: '🧤', price: 5, target: null,
    desc: 'Забери у соперника его старший козырь, а ему отдай свою младшую карту.',
    can: (g) => g.hands[1].some((c) => g.isTrump(c, 1)),
    use(fx, g) {
      const trumps = g.hands[1].filter((c) => g.isTrump(c, 1));
      const best = trumps.reduce((a, b) => (g.power(b) > g.power(a) ? b : a));
      const mine = lowestCard(g, 0);
      g.hands[1][g.hands[1].indexOf(best)] = mine;
      g.hands[0][g.hands[0].indexOf(mine)] = best;
      g.known[1].add(mine.id);
      fx.note(`Украл ${cardName(best)}`);
    },
  },
  {
    id: 'peresdacha', name: 'Пересдача', icon: '🔃', price: 3, target: null,
    desc: 'Замешай свою руку в колоду и возьми столько же новых карт.',
    can: (g) => g.deck.length >= 1,
    use(fx, g) { g.reshuffleHand(0); fx.note('Пересдача'); },
  },
  {
    id: 'joker', name: 'Джокер', icon: '🃏', price: 6, target: 'card',
    desc: 'Выбранная карта до конца партии бьёт любую карту.',
    canCard: (g, c) => !c.wild,
    use(fx, g, c) { c.wild = true; fx.note('Джокер!'); },
  },
  {
    id: 'validol', name: 'Валидол', icon: '💊', price: 5, target: null, anytime: true,
    desc: '+1 сердце (не больше максимума).',
    can: (g, run) => run.hearts < run.maxHearts,
    use(fx) { fx.heal(1); },
  },
];

function lowestCard(g, who) {
  return g.hands[who].reduce((a, b) => (aiValue(g, b, who) < aiValue(g, a, who) ? b : a));
}

const LINES_COMMON = {
  take: ['Беру.', 'Ладно, беру…', 'Давай сюда.', 'Возьму, не жалко.'],
  bito: ['Бито!', 'Отбился.', 'Мимо!', 'Не пройдёт.'],
  pass: ['Бито.', 'Всё, бито.'],
  transfer: ['Переводной!', 'Держи обратно!'],
  chase: ['И это возьми.', 'Вдогонку!'],
  win: ['Дурак! Ха!', 'Ну, бывает.', 'Ещё партейку?'],
  lose: ['Повезло тебе…', 'Ну ты шулер!', 'Сдаюсь, сдаюсь.'],
};

const ACTS = [
  {
    name: 'Двор', sub: 'лавочка у третьего подъезда',
    tables: [
      {
        id: 'vitek', name: 'Витёк', icon: '🧒', title: 'с соседнего двора', smart: 0.05, reward: 4,
        rule: null,
        lines: { hello: ['Сыграем? Я в дурака лучше всех во дворе.'], take: ['Э-э, ну ладно, беру.'], win: ['Дура-а-ак!'] },
      },
      {
        id: 'valya', name: 'Тётя Валя', icon: '👵', title: 'на лавочке с семечками', smart: 0.12, reward: 4,
        rule: { text: 'Всегда ходит первой.', rules(r) { r.firstAttacker = 1; } },
        lines: { hello: ['Садись, милок. Я хожу первой, уж не обессудь.'], take: ['Ой, беру, беру.'], bito: ['Бито, касатик.'] },
      },
      {
        id: 'misha', name: 'Дядя Миша', icon: '🧔', title: 'гроза двора', smart: 0.25, reward: 7, boss: true,
        rule: { text: 'Его шестёрки бьют тузов той же масти.', rules(r) { r.sixBeatsAce[1] = true; } },
        lines: { hello: ['У нас во дворе шестёрка туза бьёт. Не знал?'], bito: ['Бито, салага.'], win: ['Иди тренируйся.'] },
      },
    ],
  },
  {
    name: 'Электричка', sub: 'последний вагон, 23:40',
    tables: [
      {
        id: 'kostya', name: 'Студент Костя', icon: '👨‍🎓', title: 'едет с сессии', smart: 0.32, reward: 5,
        rule: { text: 'Играет в переводного: может перевести ход картой того же достоинства.', rules(r) { r.transfer[1] = true; } },
        lines: { hello: ['Только переводной, по-другому скучно.'], transfer: ['Переводим, коллега.'] },
      },
      {
        id: 'lyuba', name: 'Проводница Люба', icon: '👩‍🦰', title: 'до конечной ещё час', smart: 0.4, reward: 5,
        rule: { text: 'Колода с девяток: 24 карты, партии короткие.', rules(r) { r.minRank = 9; } },
        lines: { hello: ['Короткая колода — до конечной успеем.'], bito: ['Следующая станция — бито.'] },
      },
      {
        id: 'gosha', name: 'Шулер Гоша', icon: '🎩', title: 'ловкость рук', smart: 0.5, reward: 8, boss: true,
        rule: {
          text: 'В начале партии подтягивает себе козыря из колоды.',
          deal(g) {
            const mine = g.hands[1].filter((c) => !g.isTrump(c, 1));
            if (!mine.length) return;
            const pulled = g.pullFromDeck((c) => c.s === g.trumpSuit);
            if (!pulled) return;
            const worst = mine.reduce((a, b) => (b.r < a.r ? b : a));
            g.hands[1][g.hands[1].indexOf(worst)] = pulled.card;
            g.deck[pulled.index] = worst;
          },
        },
        lines: { hello: ['Карты не врут. Врут люди.'], win: ['Ловкость рук и никакого мошенства.'], lose: ['Ты чего, тоже шулер?'] },
      },
    ],
  },
  {
    name: 'Подпольный клуб', sub: 'вход через котельную',
    tables: [
      {
        id: 'semenych', name: 'Бухгалтер Семёныч', icon: '🧓', title: 'всё учтено', smart: 0.6, reward: 6,
        rule: { text: 'Его дама пик бьёт любую некозырную карту, а шестёрка — туза той же масти.', rules(r) { r.queenSpades[1] = true; r.sixBeatsAce[1] = true; } },
        lines: { hello: ['У меня каждая шестёрка на счету. И дама пик тоже.'], bito: ['Сальдо в мою пользу.'], chase: ['Проведём и это.'] },
      },
      {
        id: 'roza', name: 'Мадам Роза', icon: '💃', title: 'хозяйка рулетки', smart: 0.68, reward: 6,
        rule: { text: 'Когда ты берёшь, подкидывает карты любого достоинства.', rules(r) { r.freeThrowOnTake[1] = true; } },
        lines: { hello: ['Берёшь — бери всё, дорогуша.'], chase: ['И это тебе, дорогуша.'] },
      },
      {
        id: 'hozyain', name: 'Хозяин', icon: '🤵', title: 'в его клубе свои правила', smart: 0.85, reward: 12, boss: true,
        rule: { text: 'Его валеты — козыри, и первым всегда ходит он.', rules(r) { r.jacksTrump[1] = true; r.firstAttacker = 1; } },
        lines: { hello: ['В моём клубе валеты служат мне. И хожу первым я.'], win: ['Следующий.'], lose: ['…Неплохо. Очень неплохо.'] },
      },
    ],
  },
];

const BACKS = [
  { id: 'red', name: 'Красная', color: '#8e2323', desc: 'Классика. Без сюрпризов.', unlock: null },
  {
    id: 'blue', name: 'Синяя', color: '#21477e', desc: '+1 ячейка для фокусов и случайный фокус на старте.',
    unlock: { text: 'Пройди первый акт', check: (m) => m.bestAct >= 1 },
  },
  {
    id: 'violet', name: 'Фиолетовая', color: '#57286b', desc: 'Начинаешь с талисманом «Переводной».',
    unlock: { text: 'Выиграй 15 партий', check: (m) => m.gamesWon >= 15 },
  },
  {
    id: 'black', name: 'Чёрная', color: '#1c1c22', desc: 'Сразу «Двойной козырь», но сердец всего два.',
    unlock: { text: 'Пройди весь забег', check: (m) => m.runsWon >= 1 },
  },
];

const talismanById = (id) => TALISMANS.find((t) => t.id === id);
const trickById = (id) => TRICKS.find((t) => t.id === id);
