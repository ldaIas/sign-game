// Daily challenge: one birthday per day, five questions answered in order,
// with a shared pool of misses. Progress and the day streak live in localStorage.

const DAILY_MISSES = 5;
const DAILY_KEY = "sign-game:daily";
const DAILY_STREAK_KEY = "sign-game:daily-streak";
// Puzzle #1 is the launch day; the number counts up from there.
const DAILY_EPOCH = [2026, 11, 17];

const QUESTIONS = [
  {
    label: "Sign",
    ask: "Which sign?",
    answer: s => s.name,
    options: () => WHEEL_ORDER.map(name => ({ value: name, html: name })),
    show: name => name,
    hint: (guess, s) => distanceHint(guess, s.name),
  },
  {
    label: "Symbol",
    ask: "Which symbol is it?",
    answer: s => s.name,
    // Shuffled per day so the position in the wheel doesn't give it away.
    options: (s, rand) => shuffle(WHEEL_ORDER, rand).map(name => ({
      value: name,
      html: `<span class="glyph">${signByName(name).glyph}${TEXT_STYLE}</span>`,
      label: `Symbol of ${name}`,
    })),
    show: name => `<span class="glyph">${signByName(name).glyph}${TEXT_STYLE}</span>`,
    hint: guess => ({ tag: guess, text: `That's the symbol for ${guess}.` }),
  },
  {
    label: "Gender",
    ask: "Masculine or feminine?",
    answer: s => s.gender,
    options: () => Object.entries(GENDERS).map(([name, g]) => ({
      value: name,
      html: `<span class="glyph">${g.glyph}${TEXT_STYLE}</span>${name}`,
    })),
    show: name => name,
    hint: () => null,
  },
  {
    label: "Element",
    ask: "Which element?",
    answer: s => s.element,
    options: () => Object.entries(ELEMENTS).map(([name, el]) => ({
      value: name,
      html: `<span class="glyph" style="color:${el.color}">${el.glyph}</span>${name}`,
    })),
    show: name => name,
    hint: guess => ({
      text: `${guess} signs are ${listSigns(SIGNS.filter(x => x.element === guess).map(x => x.name))}.`,
    }),
  },
  {
    label: "Opposite",
    ask: "Which sign sits opposite it on the wheel?",
    answer: s => s.opposite,
    // Shuffled too, or you could just count six buttons along from the sign.
    options: (s, rand) => shuffle(WHEEL_ORDER, rand).map(name => ({
      value: name,
      html: `<span class="glyph">${signByName(name).glyph}${TEXT_STYLE}</span>${name}`,
    })),
    show: name => name,
    hint: (guess, s) => distanceHint(guess, s.opposite),
  },
];

const daily = {
  date: null,       // "YYYY-MM-DD", the player's local date
  number: 0,
  birthday: null,
  sign: null,
  options: [],      // per question, fixed for the day
  guesses: [],      // [questionIndex, value] in the order they were made
  question: 0,
  missesLeft: DAILY_MISSES,
  results: [],      // per question: { misses, revealed }
  status: "playing", // "playing" | "won" | "lost"
  countdown: null,
};

function startDaily() {
  const today = localDateKey(new Date());
  daily.date = today;
  daily.number = daysBetween(DAILY_EPOCH, today.split("-").map(Number)) + 1;

  const rand = seededRandom(`sign-game ${today}`);
  daily.birthday = birthdayFrom(rand);
  daily.sign = signFor(daily.birthday.month, daily.birthday.day);
  daily.options = QUESTIONS.map(q => q.options(daily.sign, rand));

  daily.guesses = [];
  daily.question = 0;
  daily.missesLeft = DAILY_MISSES;
  daily.results = QUESTIONS.map(() => ({ misses: [], revealed: false }));
  daily.status = "playing";

  // Replay today's saved guesses so a reload picks up where the player left off.
  const saved = loadJSON(DAILY_KEY);
  if (saved && saved.date === today && Array.isArray(saved.guesses)) {
    for (const [q, value] of saved.guesses) {
      if (daily.status !== "playing" || q !== daily.question) break;
      applyGuess(value);
    }
  }

  const b = daily.birthday;
  $("daily-tag").textContent = `Daily #${daily.number}`;
  $("birthday").textContent = `${MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  $("reveal").hidden = true;
  $("signs").hidden = true;
  $("elements").hidden = true;
  $("next").hidden = true;
  $("start").hidden = true;

  renderDaily();
  if (daily.status !== "playing") showDailyEnd(false);
}

function stopDaily() {
  clearInterval(daily.countdown);
  daily.countdown = null;
}

// Records a guess for the current question and advances the game state.
// Returns the hint for a miss, if any.
function applyGuess(value) {
  const q = daily.question;
  const correct = QUESTIONS[q].answer(daily.sign);
  daily.guesses.push([q, value]);

  if (value === correct) {
    advance();
    return null;
  }

  daily.results[q].misses.push(value);
  daily.missesLeft -= 1;
  if (daily.missesLeft === 0) {
    finish("lost");
    return null;
  }
  // Nothing left to choose between (e.g. gender after one miss): give it to them.
  const remaining = daily.options[q].filter(o => !daily.results[q].misses.includes(o.value));
  if (remaining.length === 1) {
    daily.results[q].revealed = true;
    advance();
    return null;
  }
  return QUESTIONS[q].hint(value, daily.sign);
}

function advance() {
  daily.question += 1;
  if (daily.question === QUESTIONS.length) finish("won");
}

function finish(status) {
  daily.status = status;
  if (status === "lost") {
    for (let i = daily.question; i < QUESTIONS.length; i++) daily.results[i].revealed = true;
  }
}

function onDailyGuess(value) {
  if (daily.status !== "playing") return;
  const q = daily.question;
  const hint = applyGuess(value);
  if (QUESTIONS[q].label === "Sign" && value === daily.sign.name) Sky.constellation(daily.sign.name);
  saveJSON(DAILY_KEY, { date: daily.date, guesses: daily.guesses });

  if (daily.status !== "playing") {
    recordStreak(daily.status === "won");
    renderDaily(value);
    showDailyEnd(true);
    return;
  }

  renderDaily(value);
  if (daily.question !== q) {
    const r = daily.results[q];
    const answer = QUESTIONS[q].answer(daily.sign);
    if (r.revealed) setPrompt(`Not quite — it's ${answer}. ${QUESTIONS[daily.question].ask}`, "bad");
    else setPrompt(`Yes! ${QUESTIONS[daily.question].ask}`, "good");
  } else if (hint) {
    setPrompt(hint.text, "bad");
  }
}

function renderDaily(lastGuess) {
  $("misses").textContent = daily.missesLeft;
  $("day-streak").textContent = currentStreak();

  // Board: answered questions, plus the current one. Everything once the game ends.
  const shown = daily.status === "playing" ? daily.question + 1 : QUESTIONS.length;
  const before = lastGuess === undefined ? 0 : $("board").children.length;
  $("board").innerHTML = "";
  for (let i = 0; i < shown; i++) {
    const q = QUESTIONS[i];
    const r = daily.results[i];
    const li = document.createElement("li");
    const current = i === daily.question && daily.status === "playing";
    let mark = "";
    if (!current) {
      if (r.revealed) mark = `<span class="mark bad">revealed</span>`;
      else if (r.misses.length) mark = `<span class="mark">${r.misses.length} miss${r.misses.length === 1 ? "" : "es"}</span>`;
      else mark = `<span class="mark good">✓</span>`;
    }
    li.className = current ? "current" : r.revealed ? "revealed" : "solved";
    if (i >= before) li.classList.add("fresh");
    li.innerHTML = `<span class="q">${q.label}</span>
      <span class="a">${current ? "?" : q.show(q.answer(daily.sign))}</span>${mark}`;
    $("board").appendChild(li);
  }

  // Tally: one box per guess made, ✓ or ✗, newest one pops in.
  $("tally").innerHTML = "";
  daily.guesses.forEach(([q, value], i) => {
    const right = value === QUESTIONS[q].answer(daily.sign);
    const box = document.createElement("span");
    box.className = right ? "right" : "wrong";
    if (lastGuess !== undefined && i === daily.guesses.length - 1) box.classList.add("fresh");
    box.textContent = right ? "✓" : "✗";
    box.title = `${QUESTIONS[q].label}: ${right ? "correct" : "miss"}`;
    $("tally").appendChild(box);
  });

  // Answer grid for the current question.
  const grid = $("choices");
  grid.innerHTML = "";
  grid.hidden = daily.status !== "playing";
  if (daily.status === "playing") {
    const q = daily.question;
    const misses = daily.results[q].misses;
    grid.dataset.count = daily.options[q].length;
    for (const opt of daily.options[q]) {
      const btn = document.createElement("button");
      btn.innerHTML = opt.html;
      if (opt.label) btn.setAttribute("aria-label", opt.label);
      if (misses.includes(opt.value)) {
        btn.disabled = true;
        btn.classList.add("wrong");
        if (opt.value === lastGuess) btn.classList.add("fresh");
        const hint = QUESTIONS[q].hint(opt.value, daily.sign);
        if (hint && hint.tag) btn.insertAdjacentHTML("beforeend", `<span class="tag">${hint.tag}</span>`);
      }
      btn.addEventListener("click", () => onDailyGuess(opt.value));
      grid.appendChild(btn);
    }
    if (lastGuess === undefined) setPrompt(QUESTIONS[q].ask);
  }
}

function showDailyEnd(justFinished) {
  const s = daily.sign;
  $("reveal-glyph").textContent = s.glyph + TEXT_STYLE;
  $("reveal-glyph").style.setProperty("--glow", ELEMENTS[s.element].color);
  $("reveal-name").textContent = s.name;
  $("reveal-range").textContent = `${formatRange(s)} · ${s.element}`;
  $("reveal").hidden = false;

  const missed = DAILY_MISSES - daily.missesLeft;
  if (daily.status === "won") {
    const how = missed === 0 ? "a perfect run!" : `with ${missed} miss${missed === 1 ? "" : "es"}.`;
    setPrompt(`${justFinished ? "Solved" : "You solved today's"} — ${how}`, "good");
  } else {
    setPrompt("Out of guesses. Here's the full answer.", "bad");
  }

  const tick = () => { $("countdown").textContent = `Next date in ${timeUntilMidnight()}`; };
  tick();
  stopDaily();
  daily.countdown = setInterval(() => {
    if (localDateKey(new Date()) !== daily.date) startDaily();
    else tick();
  }, 30000);
  $("countdown").hidden = false;
}

// --- Streak ---------------------------------------------------------------

// A streak counts consecutive days solved. Missing a day or losing resets it.
function recordStreak(won) {
  const rec = loadJSON(DAILY_STREAK_KEY) || { streak: 0, best: 0, lastWin: null };
  if (won) {
    rec.streak = rec.lastWin === shiftDate(daily.date, -1) ? rec.streak + 1 : 1;
    rec.lastWin = daily.date;
    rec.best = Math.max(rec.best || 0, rec.streak);
  } else {
    rec.streak = 0;
  }
  saveJSON(DAILY_STREAK_KEY, rec);
}

function currentStreak() {
  const rec = loadJSON(DAILY_STREAK_KEY);
  if (!rec || !rec.lastWin) return 0;
  // Still alive if solved today or yesterday (today's puzzle may be unplayed).
  const alive = rec.lastWin === daily.date || rec.lastWin === shiftDate(daily.date, -1);
  return alive ? rec.streak : 0;
}

// --- Helpers --------------------------------------------------------------

// "Aries is 2 signs behind": the guess comes earlier in the wheel than the answer.
function distanceHint(guess, answer) {
  const diff = (WHEEL_ORDER.indexOf(answer) - WHEEL_ORDER.indexOf(guess) + 12) % 12;
  if (diff === 6) return { tag: "6 away", text: `${guess} is 6 signs away — straight across the wheel.` };
  const n = diff < 6 ? diff : 12 - diff;
  const dir = diff < 6 ? "behind" : "ahead";
  return { tag: `${n} ${dir}`, text: `${guess} is ${n} sign${n === 1 ? "" : "s"} ${dir}.` };
}

function listSigns(names) {
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function birthdayFrom(rand) {
  const year = 1950 + Math.floor(rand() * 60);
  const dayOfYear = Math.floor(rand() * 365);
  const date = new Date(year, 0, 1 + dayOfYear);
  return { year, month: date.getMonth() + 1, day: date.getDate() };
}

// Small deterministic PRNG (xmur3 hash seeding mulberry32), so every player
// gets the same puzzle on the same date without a server.
function seededRandom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function localDateKey(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDate(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

function daysBetween([y1, m1, d1], [y2, m2, d2]) {
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function timeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.ceil((midnight - now) / 60000);
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
