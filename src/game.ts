// Mode switch, plus the Classic and Timed modes.

import { startDaily, stopDaily } from "./daily";
import {
  ELEMENTS, MONTHS, TEXT_STYLE, WHEEL_ORDER,
  formatRange, randomBirthday, signByName, signFor, type Sign,
} from "./signs";
import { hideShare, showShare } from "./share";
import { constellation } from "./sky";
import { loadItem, saveItem } from "./storage";
import { $, $$, announce, setPrompt } from "./ui";

type Mode = "daily" | "classic" | "timed";

const SIGN_GUESSES = 3;
const TIMED_SECONDS = 60;
const BEST_KEY = "sign-game:timed-best";

const state = {
  mode: "daily" as Mode,
  sign: null as Sign | null,
  guessesLeft: SIGN_GUESSES,
  phase: "sign" as "idle" | "sign" | "element" | "done",
  score: 0,
  streak: 0,
  timeLeft: TIMED_SECONDS,
  timer: null as ReturnType<typeof setInterval> | null,
  best: Number(loadItem(BEST_KEY)) || 0,
  refocus: null as number | null, // timed mode: index of the sign button to refocus on the next birthday
  birthday: "",
  timedMarks: [] as boolean[],
  timedMisses: [] as { birthday: string; sign: string; guess: string }[],
  typed: "",
  typedReset: null as ReturnType<typeof setTimeout> | null,
};

function currentSign(): Sign {
  return state.sign!;
}

function buildSignButtons(): void {
  $("signs").innerHTML = "";
  for (const name of WHEEL_ORDER) {
    const sign = signByName(name);
    const btn = document.createElement("button");
    btn.dataset.name = name;
    btn.type = "button";
    btn.innerHTML = `<span class="glyph" aria-hidden="true">${sign.glyph}${TEXT_STYLE}</span>${name}`;
    btn.addEventListener("click", () => onSignGuess(btn));
    $("signs").appendChild(btn);
  }
}

function buildElementButtons(): void {
  $("elements").innerHTML = "";
  for (const [name, el] of Object.entries(ELEMENTS)) {
    const btn = document.createElement("button");
    btn.dataset.name = name;
    btn.type = "button";
    btn.innerHTML = `<span class="glyph" aria-hidden="true" style="color:${el.color}">${el.glyph}</span>${name}`;
    btn.addEventListener("click", () => onElementGuess(btn));
    $("elements").appendChild(btn);
  }
}

function setMode(mode: Mode): void {
  stopTimer();
  state.mode = mode;
  state.score = 0;
  state.streak = 0;
  for (const btn of $$("#modes button")) {
    btn.classList.toggle("active", btn.dataset.mode === mode);
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
  }
  for (const el of $$<HTMLElement>("[data-only]")) el.hidden = !el.dataset.only!.split(" ").includes(mode);
  stopDaily();
  hideShare();
  $("missed").hidden = true;

  if (mode === "daily") {
    startDaily();
  } else if (mode === "timed") {
    showTimedIntro();
  } else {
    newRound();
  }
  updateStats();
}

function newRound(): void {
  const b = randomBirthday();
  state.sign = signFor(b.month, b.day);
  state.guessesLeft = state.mode === "timed" ? 1 : SIGN_GUESSES;
  state.phase = "sign";
  // "Next" and "Start" hide themselves here; keep keyboard focus in the game.
  const buttonGone = [$("next"), $("start")].includes(document.activeElement as HTMLElement);

  state.birthday = `${MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  $("birthday").textContent = state.birthday;
  $("reveal").hidden = true;
  $("elements").hidden = true;
  $("signs").hidden = false;
  $("next").hidden = true;
  $("start").hidden = true;
  for (const btn of $$(".grid button")) {
    btn.disabled = false;
    btn.classList.remove("wrong", "right");
  }
  clearTyped();
  setPrompt(guessesText(), "", `Born on ${$("birthday").textContent}. ${guessesText()}`);
  // Timed mode disables the grid between birthdays, which drops keyboard focus;
  // put it back on the same button so keyboard players can keep going.
  if (state.refocus != null) {
    $$("#signs button")[state.refocus]?.focus();
    state.refocus = null;
  } else if (buttonGone) {
    focusFirstEnabled($("signs"));
  }
}

function guessesText(): string {
  if (state.mode === "timed") return "Which sign?";
  const n = state.guessesLeft;
  return `Which sign? ${n} guess${n === 1 ? "" : "es"} left`;
}

function scoreText(): string {
  return ` Score ${state.score}.`;
}

// After a button is disabled, move focus to a sensible neighbour instead of losing it.
function focusFirstEnabled(container: HTMLElement): void {
  const btn = container.querySelector<HTMLButtonElement>("button:not(:disabled)");
  if (btn) btn.focus();
}

function onSignGuess(btn: HTMLButtonElement): void {
  if (state.phase !== "sign") return;
  if (state.mode === "timed") return onTimedGuess(btn);
  const sign = currentSign();
  btn.disabled = true;

  if (btn.dataset.name === sign.name) {
    btn.classList.add("right");
    state.score += 1;
    state.streak += 1;
    constellation(sign.name);
    revealSign();
    startElementBonus();
    return;
  }

  const hadFocus = btn === document.activeElement;
  btn.classList.add("wrong");
  state.guessesLeft -= 1;
  if (state.guessesLeft > 0) {
    setPrompt(`Not ${btn.dataset.name}. ${guessesText()}`, "bad", `Wrong: not ${btn.dataset.name}. ${guessesText()}`);
    if (hadFocus) focusFirstEnabled($("signs"));
    return;
  }

  state.streak = 0;
  markCorrectSign();
  revealSign();
  finishRound(`Out of guesses — it was ${sign.name}.`, "bad", `Wrong. Out of guesses — it was ${sign.name}.`);
}

function markCorrectSign(): void {
  $("signs").querySelector(`[data-name="${currentSign().name}"]`)!.classList.add("right");
}

function disableSigns(): void {
  for (const btn of $$("#signs button")) btn.disabled = true;
}

function startElementBonus(): void {
  const sign = currentSign();
  state.phase = "element";
  disableSigns();
  $("elements").hidden = false;
  setPrompt(`${sign.name}! Bonus: which element? (1 guess)`, "good",
    `Correct, ${sign.name}!${scoreText()} Bonus: which element? One guess.`);
  updateStats();
  focusFirstEnabled($("elements"));
}

function onElementGuess(btn: HTMLButtonElement): void {
  if (state.phase !== "element") return;
  for (const b of $$("#elements button")) b.disabled = true;

  const sign = currentSign();
  const correct = sign.element;
  const article = /^[AEIOU]/.test(correct) ? "an" : "a";
  $("elements").querySelector(`[data-name="${correct}"]`)!.classList.add("right");
  if (btn.dataset.name === correct) {
    state.score += 1;
    finishRound(`Yes — ${sign.name} is ${article} ${correct} sign. +1 bonus`, "good",
      `Correct — ${sign.name} is ${article} ${correct} sign. Plus 1 bonus.`);
  } else {
    btn.classList.add("wrong");
    finishRound(`Close — ${sign.name} is ${article} ${correct} sign.`, "bad",
      `Wrong — ${sign.name} is ${article} ${correct} sign.`);
  }
}

function finishRound(message: string, tone: string, spoken = message): void {
  state.phase = "done";
  disableSigns();
  revealElement();
  setPrompt(message, tone, spoken + scoreText());
  updateStats();
  $("next").hidden = false;
  $("next").focus();
}

// Timed mode: one guess per birthday, and the next one appears automatically.
function onTimedGuess(btn: HTMLButtonElement): void {
  const sign = currentSign();
  state.phase = "done";
  if (btn === document.activeElement) state.refocus = [...$$("#signs button")].indexOf(btn);
  disableSigns();
  const right = btn.dataset.name === sign.name;
  state.timedMarks.push(right);
  if (!right) state.timedMisses.push({ birthday: state.birthday, sign: sign.name, guess: btn.dataset.name! });
  if (right) {
    state.score += 1;
    btn.classList.add("right");
    constellation(sign.name);
    setPrompt(`${sign.name}! +1`, "good", `Correct, ${sign.name}!${scoreText()}`);
  } else {
    btn.classList.add("wrong");
    markCorrectSign();
    setPrompt(`It was ${sign.name}.`, "bad", `Wrong, it was ${sign.name}.${scoreText()}`);
  }
  revealSign();
  revealElement();
  updateStats();
  // A miss lingers a little longer so the right answer can sink in.
  setTimeout(() => { if (state.timer) newRound(); else state.refocus = null; }, right ? 450 : 1000);
}

function showTimedIntro(): void {
  state.phase = "idle";
  state.timeLeft = TIMED_SECONDS;
  $("birthday").textContent = "Ready?";
  $("reveal").hidden = true;
  $("elements").hidden = true;
  $("signs").hidden = true;
  $("next").hidden = true;
  $("start").hidden = false;
  $("start").textContent = "Start 60 seconds";
  $("missed").hidden = true;
  setPrompt("Name as many signs as you can in 60 seconds. One guess each.");
  renderTime();
}

function startTimed(): void {
  state.score = 0;
  state.timedMarks = [];
  state.timedMisses = [];
  $("missed").hidden = true;
  hideShare();
  state.timeLeft = TIMED_SECONDS;
  updateStats();
  renderTime();
  state.timer = setInterval(tick, 1000);
  newRound();
}

function tick(): void {
  state.timeLeft -= 1;
  renderTime();
  if (state.timeLeft === 30 || state.timeLeft === 10) announce(`${state.timeLeft} seconds left.`);
  if (state.timeLeft <= 0) endTimed();
}

function stopTimer(): void {
  if (state.timer !== null) clearInterval(state.timer);
  state.timer = null;
}

function endTimed(): void {
  stopTimer();
  state.phase = "idle";
  disableSigns();
  const newBest = state.score > state.best;
  if (newBest) {
    state.best = state.score;
    saveItem(BEST_KEY, String(state.best));
  }
  $("birthday").textContent = `Time's up! ${state.score} point${state.score === 1 ? "" : "s"}`;
  $("reveal").hidden = true;
  setPrompt(newBest ? "New best!" : `Best: ${state.best}`, newBest ? "good" : "",
    `Time's up! ${state.score} point${state.score === 1 ? "" : "s"}. ${newBest ? "New best!" : `Best: ${state.best}.`}`);
  $("start").textContent = "Play again";
  $("start").hidden = false;
  $("start").focus();
  renderMissed();
  const marks = state.timedMarks.map(r => r ? "✓" : "✗").join("");
  showShare(`Zodle Timed · ${state.score} in ${TIMED_SECONDS}s ${marks}`.trimEnd());
  updateStats();
}

function renderMissed(): void {
  const list = $("missed-list");
  list.innerHTML = "";
  for (const m of state.timedMisses) {
    const li = document.createElement("li");
    const glyph = `<span class="glyph" aria-hidden="true">${signByName(m.sign).glyph}${TEXT_STYLE}</span>`;
    li.innerHTML = `<span class="when"></span><span class="sign">${glyph} ${m.sign}</span><span class="guess"></span>`;
    li.querySelector(".when")!.textContent = m.birthday;
    li.querySelector(".guess")!.textContent = `you said ${m.guess}`;
    list.appendChild(li);
  }
  $("missed-title").textContent = state.timedMisses.length ? `Missed (${state.timedMisses.length})` : "No misses!";
  $("missed").hidden = state.timedMarks.length === 0;
}

// Timed keyboard shortcut: type a sign's first letters ("ar" Aries, "aq" Aquarius).
// It answers as soon as the letters fit only one sign.
function onTypedKey(e: KeyboardEvent): void {
  if (state.mode !== "timed" || state.phase !== "sign") return;
  if (e.ctrlKey || e.metaKey || e.altKey || !/^[a-z]$/i.test(e.key)) return;
  if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], dialog")) return;
  e.preventDefault();

  const fits = (prefix: string) => WHEEL_ORDER.filter(n => n.toLowerCase().startsWith(prefix));
  const key = e.key.toLowerCase();
  // Letters that fit nothing start a new sign rather than ending the game on a typo.
  const typed = fits(state.typed + key).length ? state.typed + key : key;
  const matches = fits(typed);
  if (state.typedReset !== null) clearTimeout(state.typedReset);

  if (matches.length === 1) {
    clearTyped();
    $("signs").querySelector<HTMLButtonElement>(`[data-name="${matches[0]}"]`)!.click();
    return;
  }
  state.typed = matches.length ? typed : "";
  for (const btn of $$("#signs button")) btn.classList.toggle("typed", matches.includes(btn.dataset.name!));
  state.typedReset = setTimeout(clearTyped, 1200);
}

function clearTyped(): void {
  if (state.typedReset !== null) clearTimeout(state.typedReset);
  state.typedReset = null;
  state.typed = "";
  for (const btn of $$("#signs button")) btn.classList.remove("typed");
}

function renderTime(): void {
  $("time").textContent = String(state.timeLeft);
  const fill = $("timebar-fill");
  fill.style.width = `${(state.timeLeft / TIMED_SECONDS) * 100}%`;
  fill.classList.toggle("low", state.timeLeft <= 10);
}

function revealSign(): void {
  const s = currentSign();
  $("reveal-glyph").textContent = s.glyph + TEXT_STYLE;
  $("reveal-glyph").style.removeProperty("--glow");
  $("reveal-name").textContent = s.name;
  // The element, including its glow colour, stays hidden until the bonus question is answered.
  $("reveal-range").textContent = formatRange(s);
  $("reveal").hidden = false;
}

function revealElement(): void {
  const s = currentSign();
  $("reveal-glyph").style.setProperty("--glow", ELEMENTS[s.element].color);
  $("reveal-range").textContent = `${formatRange(s)} · ${s.element}`;
}

function updateStats(): void {
  $("score").textContent = String(state.score);
  $("streak").textContent = String(state.streak);
  $("best").textContent = String(state.best);
}

export function initGame(): void {
  $("next").addEventListener("click", newRound);
  $("start").addEventListener("click", startTimed);
  document.addEventListener("keydown", onTypedKey);
  for (const btn of $$("#modes button")) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode as Mode));
  }

  buildSignButtons();
  buildElementButtons();
  setMode("daily");
}
