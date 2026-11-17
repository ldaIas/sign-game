// Daily challenge: one birthday per day, five questions answered in order,
// with a shared pool of misses. Progress and the day streak live in localStorage.

import {
  DAILY_KEY, DAILY_MISSES, QUESTIONS,
  applyGuess, createDaily, currentStreak, localDateKey, recordStreak, replayGuesses, timeUntilMidnight,
  type DailyState, type SavedDaily,
} from "./puzzle";
import { ELEMENTS, MONTHS, TEXT_STYLE, formatRange } from "./signs";
import { constellation } from "./sky";
import { loadJSON, saveJSON } from "./storage";
import { $, announce, setPrompt } from "./ui";

let daily: DailyState;
let countdown: ReturnType<typeof setInterval> | null = null;

export function startDaily(): void {
  daily = createDaily(localDateKey(new Date()));
  replayGuesses(daily, loadJSON<SavedDaily>(DAILY_KEY));

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

export function stopDaily(): void {
  if (countdown !== null) clearInterval(countdown);
  countdown = null;
}

function onDailyGuess(value: string): void {
  if (daily.status !== "playing") return;
  const q = daily.question;
  const hint = applyGuess(daily, value);
  if (QUESTIONS[q].label === "Sign" && value === daily.sign.name) constellation(daily.sign.name);
  saveJSON(DAILY_KEY, { date: daily.date, guesses: daily.guesses } satisfies SavedDaily);
  // The answer grid is rebuilt below, which drops keyboard focus; restore it after.
  const hadFocus = $("choices").contains(document.activeElement);

  if (daily.status !== "playing") {
    recordStreak(daily.date, daily.status === "won");
    renderDaily(value);
    showDailyEnd(true);
    // Move focus to the full answer list so keyboard and screen reader users land on the result.
    if (hadFocus) $("board").focus();
    return;
  }

  renderDaily(value);
  const left = ` ${daily.missesLeft} miss${daily.missesLeft === 1 ? "" : "es"} left.`;
  if (daily.question !== q) {
    const r = daily.results[q];
    const answer = QUESTIONS[q].answer(daily.sign);
    const next = QUESTIONS[daily.question].ask;
    if (r.revealed) setPrompt(`Not quite — it's ${answer}. ${next}`, "bad", `Wrong. It's ${answer}.${left} ${next}`);
    else setPrompt(`Yes! ${next}`, "good", `Correct!${r.misses.length ? left : ""} ${next}`);
  } else if (hint) {
    setPrompt(hint.text, "bad", `Wrong. ${hint.text}${left}`);
  } else {
    announce(`Wrong.${left}`);
  }
  if (hadFocus) {
    const btns = [...$("choices").querySelectorAll("button")];
    const same = btns.find(b => b.dataset.value === value)!;
    // Stay on the same question's grid near where the player was; else start of the new grid.
    const target = daily.question === q ? btns.find(b => !b.disabled && btns.indexOf(b) > btns.indexOf(same)) || btns.find(b => !b.disabled) : btns[0];
    target?.focus();
  }
}

function renderDaily(lastGuess?: string): void {
  $("misses").textContent = String(daily.missesLeft);
  $("day-streak").textContent = String(currentStreak(daily.date));

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
      else mark = `<span class="mark good"><span aria-hidden="true">✓</span><span class="visually-hidden">correct</span></span>`;
    }
    li.className = current ? "current" : r.revealed ? "revealed" : "solved";
    if (i >= before) li.classList.add("fresh");
    li.innerHTML = `<span class="q">${q.label}</span>
      <span class="a">${current ? `<span aria-hidden="true">?</span><span class="visually-hidden">not answered yet</span>` : q.show(q.answer(daily.sign))}</span>${mark}`;
    $("board").appendChild(li);
  }

  // Tally: one box per guess made, ✓ or ✗, newest one pops in.
  $("tally").innerHTML = "";
  daily.guesses.forEach(([q, value], i) => {
    const right = value === QUESTIONS[q].answer(daily.sign);
    const box = document.createElement("span");
    box.className = right ? "right" : "wrong";
    if (lastGuess !== undefined && i === daily.guesses.length - 1) box.classList.add("fresh");
    box.title = `${QUESTIONS[q].label}: ${right ? "correct" : "miss"}`;
    box.innerHTML = `<span aria-hidden="true">${right ? "✓" : "✗"}</span><span class="visually-hidden">${box.title}</span>`;
    $("tally").appendChild(box);
  });

  // Answer grid for the current question.
  const grid = $("choices");
  grid.innerHTML = "";
  grid.hidden = daily.status !== "playing";
  if (daily.status === "playing") {
    const q = daily.question;
    const misses = daily.results[q].misses;
    grid.dataset.count = String(daily.options[q].length);
    for (const opt of daily.options[q]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.value = opt.value;
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
    if (lastGuess === undefined) {
      const b = daily.birthday;
      setPrompt(QUESTIONS[q].ask, "", `Daily #${daily.number}. Born on ${MONTHS[b.month - 1]} ${b.day}, ${b.year}. ${QUESTIONS[q].ask}`);
    }
  }
}

function showDailyEnd(justFinished: boolean): void {
  const s = daily.sign;
  $("reveal-glyph").textContent = s.glyph + TEXT_STYLE;
  $("reveal-glyph").style.setProperty("--glow", ELEMENTS[s.element].color);
  $("reveal-name").textContent = s.name;
  $("reveal-range").textContent = `${formatRange(s)} · ${s.element}`;
  $("reveal").hidden = false;

  const missed = DAILY_MISSES - daily.missesLeft;
  if (daily.status === "won") {
    const how = missed === 0 ? "a perfect run!" : `with ${missed} miss${missed === 1 ? "" : "es"}.`;
    const text = `${justFinished ? "Solved" : "You solved today's"} — ${how}`;
    setPrompt(text, "good", `${text} It was ${s.name}. Day streak ${currentStreak(daily.date)}.`);
  } else {
    const text = "Out of guesses. Here's the full answer.";
    setPrompt(text, "bad", `${text} It was ${s.name}, ${s.element}.`);
  }

  const tick = () => { $("countdown").textContent = `Next date in ${timeUntilMidnight()}`; };
  tick();
  stopDaily();
  countdown = setInterval(() => {
    if (localDateKey(new Date()) !== daily.date) startDaily();
    else tick();
  }, 30000);
  $("countdown").hidden = false;
}
