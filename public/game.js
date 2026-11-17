const SIGN_GUESSES = 3;
const TIMED_SECONDS = 60;
const BEST_KEY = "sign-game:timed-best";
// U+FE0E asks for the text form of the zodiac glyphs instead of colour emoji.
const TEXT_STYLE = "︎";

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const state = {
  mode: "classic", // "classic" | "timed"
  sign: null,
  guessesLeft: SIGN_GUESSES,
  phase: "sign", // "idle" | "sign" | "element" | "done"
  score: 0,
  streak: 0,
  timeLeft: TIMED_SECONDS,
  timer: null,
  best: loadBest(),
};

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function saveBest(n) {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode */ }
}

function buildSignButtons() {
  $("signs").innerHTML = "";
  for (const name of WHEEL_ORDER) {
    const sign = signByName(name);
    const btn = document.createElement("button");
    btn.dataset.name = name;
    btn.innerHTML = `<span class="glyph">${sign.glyph}${TEXT_STYLE}</span>${name}`;
    btn.addEventListener("click", () => onSignGuess(btn));
    $("signs").appendChild(btn);
  }
}

function buildElementButtons() {
  $("elements").innerHTML = "";
  for (const [name, el] of Object.entries(ELEMENTS)) {
    const btn = document.createElement("button");
    btn.dataset.name = name;
    btn.innerHTML = `<span class="glyph" style="color:${el.color}">${el.glyph}</span>${name}`;
    btn.addEventListener("click", () => onElementGuess(btn));
    $("elements").appendChild(btn);
  }
}

function setMode(mode) {
  stopTimer();
  state.mode = mode;
  state.score = 0;
  state.streak = 0;
  for (const btn of $$("#modes button")) btn.classList.toggle("active", btn.dataset.mode === mode);
  for (const el of $$("[data-only]")) el.hidden = el.dataset.only !== mode;

  if (mode === "timed") {
    showTimedIntro();
  } else {
    newRound();
  }
  updateStats();
}

function newRound() {
  const b = randomBirthday();
  state.sign = signFor(b.month, b.day);
  state.guessesLeft = state.mode === "timed" ? 1 : SIGN_GUESSES;
  state.phase = "sign";

  $("birthday").textContent = `${MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  $("reveal").hidden = true;
  $("elements").hidden = true;
  $("signs").hidden = false;
  $("next").hidden = true;
  $("start").hidden = true;
  for (const btn of $$(".grid button")) {
    btn.disabled = false;
    btn.classList.remove("wrong", "right");
  }
  setPrompt(guessesText());
}

function guessesText() {
  if (state.mode === "timed") return "Which sign?";
  const n = state.guessesLeft;
  return `Which sign? ${n} guess${n === 1 ? "" : "es"} left`;
}

function setPrompt(text, tone = "") {
  $("prompt").textContent = text;
  $("prompt").className = tone;
}

function onSignGuess(btn) {
  if (state.phase !== "sign") return;
  if (state.mode === "timed") return onTimedGuess(btn);
  btn.disabled = true;

  if (btn.dataset.name === state.sign.name) {
    btn.classList.add("right");
    state.score += 1;
    state.streak += 1;
    revealSign();
    startElementBonus();
    return;
  }

  btn.classList.add("wrong");
  state.guessesLeft -= 1;
  if (state.guessesLeft > 0) {
    setPrompt(`Not ${btn.dataset.name}. ${guessesText()}`, "bad");
    return;
  }

  state.streak = 0;
  markCorrectSign();
  revealSign();
  finishRound(`Out of guesses — it was ${state.sign.name}.`, "bad");
}

function markCorrectSign() {
  $("signs").querySelector(`[data-name="${state.sign.name}"]`).classList.add("right");
}

function disableSigns() {
  for (const btn of $$("#signs button")) btn.disabled = true;
}

function startElementBonus() {
  state.phase = "element";
  disableSigns();
  $("elements").hidden = false;
  setPrompt(`${state.sign.name}! Bonus: which element? (1 guess)`, "good");
  updateStats();
}

function onElementGuess(btn) {
  if (state.phase !== "element") return;
  for (const b of $$("#elements button")) b.disabled = true;

  const correct = state.sign.element;
  const article = /^[AEIOU]/.test(correct) ? "an" : "a";
  $("elements").querySelector(`[data-name="${correct}"]`).classList.add("right");
  if (btn.dataset.name === correct) {
    state.score += 1;
    finishRound(`Yes — ${state.sign.name} is ${article} ${correct} sign. +1 bonus`, "good");
  } else {
    btn.classList.add("wrong");
    finishRound(`Close — ${state.sign.name} is ${article} ${correct} sign.`, "bad");
  }
}

function finishRound(message, tone) {
  state.phase = "done";
  disableSigns();
  revealElement();
  setPrompt(message, tone);
  updateStats();
  $("next").hidden = false;
  $("next").focus();
}

// Timed mode: one guess per birthday, and the next one appears automatically.
function onTimedGuess(btn) {
  state.phase = "done";
  disableSigns();
  const right = btn.dataset.name === state.sign.name;
  if (right) {
    state.score += 1;
    btn.classList.add("right");
    setPrompt(`${state.sign.name}! +1`, "good");
  } else {
    btn.classList.add("wrong");
    markCorrectSign();
    setPrompt(`It was ${state.sign.name}.`, "bad");
  }
  revealSign();
  revealElement();
  updateStats();
  // A miss lingers a little longer so the right answer can sink in.
  setTimeout(() => { if (state.timer) newRound(); }, right ? 450 : 1000);
}

function showTimedIntro() {
  state.phase = "idle";
  state.timeLeft = TIMED_SECONDS;
  $("birthday").textContent = "Ready?";
  $("reveal").hidden = true;
  $("elements").hidden = true;
  $("signs").hidden = true;
  $("next").hidden = true;
  $("start").hidden = false;
  $("start").textContent = "Start 60 seconds";
  setPrompt("Name as many signs as you can in 60 seconds. One guess each.");
  renderTime();
}

function startTimed() {
  state.score = 0;
  state.timeLeft = TIMED_SECONDS;
  updateStats();
  renderTime();
  state.timer = setInterval(tick, 1000);
  newRound();
}

function tick() {
  state.timeLeft -= 1;
  renderTime();
  if (state.timeLeft <= 0) endTimed();
}

function stopTimer() {
  clearInterval(state.timer);
  state.timer = null;
}

function endTimed() {
  stopTimer();
  state.phase = "idle";
  disableSigns();
  const newBest = state.score > state.best;
  if (newBest) {
    state.best = state.score;
    saveBest(state.best);
  }
  $("birthday").textContent = `Time's up! ${state.score} point${state.score === 1 ? "" : "s"}`;
  $("reveal").hidden = true;
  setPrompt(newBest ? "New best!" : `Best: ${state.best}`, newBest ? "good" : "");
  $("start").textContent = "Play again";
  $("start").hidden = false;
  $("start").focus();
  updateStats();
}

function renderTime() {
  $("time").textContent = state.timeLeft;
  const fill = $("timebar-fill");
  fill.style.width = `${(state.timeLeft / TIMED_SECONDS) * 100}%`;
  fill.classList.toggle("low", state.timeLeft <= 10);
}

function revealSign() {
  const s = state.sign;
  $("reveal-glyph").textContent = s.glyph + TEXT_STYLE;
  $("reveal-glyph").style.removeProperty("--glow");
  $("reveal-name").textContent = s.name;
  // The element, including its glow colour, stays hidden until the bonus question is answered.
  $("reveal-range").textContent = formatRange(s);
  $("reveal").hidden = false;
}

function revealElement() {
  const s = state.sign;
  $("reveal-glyph").style.setProperty("--glow", ELEMENTS[s.element].color);
  $("reveal-range").textContent = `${formatRange(s)} · ${s.element}`;
}

function updateStats() {
  $("score").textContent = state.score;
  $("streak").textContent = state.streak;
  $("best").textContent = state.best;
}

$("next").addEventListener("click", newRound);
$("start").addEventListener("click", startTimed);
for (const btn of $$("#modes button")) {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
}

buildSignButtons();
buildElementButtons();
setMode("classic");
