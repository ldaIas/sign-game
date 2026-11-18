// The "More" tab: practice minigames. Symbols and Rulers match sign names to
// glyphs or planets by drawing lines; Gender, Modality and Element sort all
// twelve signs in one go.

import { shuffle } from "./puzzle";
import {
  ELEMENTS, GENDERS, MODALITIES, PLANETS, TEXT_STYLE, WHEEL_ORDER, signByName, type Sign,
} from "./signs";
import { constellation } from "./sky";
import { loadItem, saveItem } from "./storage";
import { $, $$, announce } from "./ui";

type GameId = "symbols" | "rulers" | "gender" | "modality" | "element";
type MatchId = "symbols" | "rulers";

interface MatchGame {
  intro: string;
  /** One target per sign, in wheel order; `value` is what answer() must return. */
  targets: () => { value: string; html: string; big?: boolean }[];
  answer: (s: Sign) => string;
}

const MATCH_GAMES: Record<MatchId, MatchGame> = {
  symbols: {
    intro: "Draw a line from each name to its symbol, or tap one then the other. Every line is checked at once.",
    targets: () => WHEEL_ORDER.map(name => ({ value: name, html: signByName(name).glyph + TEXT_STYLE, big: true })),
    answer: s => s.name,
  },
  rulers: {
    intro: "Draw a line from each sign to its ruling planet, or tap one then the other. Mercury and Venus each rule two signs.",
    // Mercury and Venus rule two signs each, so they appear twice and either copy is right.
    targets: () => WHEEL_ORDER.map(name => {
      const planet = signByName(name).ruler;
      return { value: planet, html: `<span class="glyph" aria-hidden="true">${PLANETS[planet].glyph}${TEXT_STYLE}</span>${planet}` };
    }),
    answer: s => s.ruler,
  },
};

interface SortGame {
  label: string;
  intro: string;
  options: { value: string; glyph?: string; color?: string }[];
  answer: (s: Sign) => string;
}

const SORT_GAMES: Record<Exclude<GameId, MatchId>, SortGame> = {
  gender: {
    label: "gender",
    intro: "Mark each sign masculine or feminine, then submit. One try per round.",
    options: Object.entries(GENDERS).map(([value, g]) => ({ value, glyph: g.glyph })),
    answer: s => s.gender,
  },
  modality: {
    label: "modality",
    intro: "Mark each sign cardinal, fixed or mutable, then submit. One try per round.",
    options: MODALITIES.map(value => ({ value })),
    answer: s => s.modality,
  },
  element: {
    label: "element",
    intro: "Mark each sign’s element, then submit. One try per round.",
    options: Object.entries(ELEMENTS).map(([value, e]) => ({ value, glyph: e.glyph, color: e.color })),
    answer: s => s.element,
  },
};

const GAME_KEY = "sign-game:more-game";
const SVG_NS = "http://www.w3.org/2000/svg";
// A pointer has to travel this far before a press becomes a drag rather than a tap.
const DRAG_THRESHOLD = 6;

let game: GameId = "symbols";

export function initMore(): void {
  const saved = loadItem(GAME_KEY);
  if (saved && $$(`#more-games [data-game="${saved}"]`).length) game = saved as GameId;
  for (const btn of $$("#more-games button")) {
    btn.addEventListener("click", () => {
      game = btn.dataset.game as GameId;
      saveItem(GAME_KEY, game);
      showGame();
    });
  }
  $("more-again").addEventListener("click", () => {
    showGame();
    $("more").querySelector<HTMLElement>(".match-item, #sort input")?.focus();
  });
  $("more-submit").addEventListener("click", submitSort);
  initMatch();
}

export function startMore(): void {
  showGame();
}

function showGame(): void {
  for (const btn of $$("#more-games button")) {
    btn.classList.toggle("active", btn.dataset.game === game);
    btn.setAttribute("aria-pressed", String(btn.dataset.game === game));
  }
  $("more-again").hidden = true;
  $("more-result").textContent = "";
  $("more-result").className = "";
  if (game === "symbols" || game === "rulers") startMatch(MATCH_GAMES[game]);
  else startSort(SORT_GAMES[game]);
}

function setScore(text: string): void {
  $("more-score").textContent = text;
}

function percent(right: number, total: number): string {
  return total ? `${Math.round((right / total) * 100)}%` : "—";
}

// ---- Symbols and Rulers: draw a line from each name to its match ----

const match = {
  game: MATCH_GAMES.symbols,
  guesses: 0,
  // Sign name → the target it was matched to.
  matched: new Map<string, HTMLElement>(),
  selected: null as HTMLButtonElement | null,
  drag: null as { from: HTMLButtonElement; x: number; y: number; moved: boolean } | null,
  ignoreClick: false,
};

function initMatch(): void {
  const board = $("match");
  board.addEventListener("click", e => {
    const item = (e.target as Element).closest<HTMLButtonElement>(".match-item");
    if (!item || match.ignoreClick) return;
    onItemTap(item);
  });
  board.addEventListener("pointerdown", e => {
    const item = (e.target as Element).closest<HTMLButtonElement>(".match-item");
    if (!item || item.disabled || e.button !== 0) return;
    match.drag = { from: item, x: e.clientX, y: e.clientY, moved: false };
  });
  window.addEventListener("pointermove", e => {
    const d = match.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
    d.moved = true;
    select(d.from);
    const box = board.getBoundingClientRect();
    drawLine("match-live", anchor(d.from), { x: e.clientX - box.left, y: e.clientY - box.top }, "live");
  });
  window.addEventListener("pointerup", e => {
    const d = match.drag;
    match.drag = null;
    if (!d?.moved) return;
    $("match-live")?.remove();
    // Touch pointers stay captured by the starting element, so find the drop target by position.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>(".match-item");
    if (target && !target.disabled && side(target) !== side(d.from)) attempt(d.from, target);
    else select(null);
    // The click that follows a drag must not count as a tap.
    match.ignoreClick = true;
    setTimeout(() => { match.ignoreClick = false; });
  });
  window.addEventListener("pointercancel", () => {
    match.drag = null;
    $("match-live")?.remove();
  });
  new ResizeObserver(redrawLines).observe(board);
}

function startMatch(g: MatchGame): void {
  match.game = g;
  match.guesses = 0;
  match.matched.clear();
  match.selected = null;
  $("match").hidden = false;
  $("sort").hidden = true;
  $("more-submit").hidden = true;
  $("more-intro").textContent = g.intro;
  $("match-names").innerHTML = "";
  $("match-glyphs").innerHTML = "";
  for (const name of shuffle(WHEEL_ORDER, Math.random)) {
    const btn = matchItem(name, "name");
    btn.textContent = name;
    $("match-names").appendChild(btn);
  }
  for (const t of shuffle(g.targets(), Math.random)) {
    const btn = matchItem(t.value, t.big ? "target big" : "target");
    btn.innerHTML = t.html;
    $("match-glyphs").appendChild(btn);
  }
  $("match-lines").innerHTML = "";
  renderMatchScore();
}

function matchItem(value: string, kind: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `match-item ${kind}`;
  btn.dataset.value = value;
  return btn;
}

function side(item: HTMLElement): "name" | "target" {
  return item.classList.contains("name") ? "name" : "target";
}

function onItemTap(item: HTMLButtonElement): void {
  const sel = match.selected;
  if (sel && side(sel) !== side(item)) attempt(sel, item);
  else select(sel === item ? null : item);
}

function select(item: HTMLButtonElement | null): void {
  match.selected?.classList.remove("selected");
  match.selected = item;
  item?.classList.add("selected");
}

function attempt(a: HTMLButtonElement, b: HTMLButtonElement): void {
  select(null);
  const [nameItem, target] = side(a) === "name" ? [a, b] : [b, a];
  const name = nameItem.dataset.value!;
  match.guesses += 1;
  if (match.game.answer(signByName(name)) === target.dataset.value) {
    match.matched.set(name, target);
    for (const item of [nameItem, target]) {
      item.disabled = true;
      item.classList.add("right");
    }
    drawLine(`match-line-${name}`, anchor(nameItem), anchor(target), "right");
    constellation(name);
    const left = WHEEL_ORDER.length - match.matched.size;
    announce(left ? `Right, ${name}. ${left} left.` : `Right, ${name}. All matched.`);
    // Disabling the button drops its focus; keep keyboard players in the game.
    if (left) $("match").querySelector<HTMLButtonElement>(".match-item:not(:disabled)")?.focus();
  } else {
    const line = drawLine("", anchor(nameItem), anchor(target), "wrong");
    setTimeout(() => line.remove(), 700);
    for (const item of [nameItem, target]) {
      item.classList.remove("wrong");
      void item.offsetWidth; // restart the shake
      item.classList.add("wrong");
    }
    announce(`No, that isn’t ${name}’s.`);
  }
  renderMatchScore();
  if (match.matched.size === WHEEL_ORDER.length) finishMatch();
}

function renderMatchScore(): void {
  const right = match.matched.size;
  setScore(`Matched ${right}/${WHEEL_ORDER.length} · Guesses ${match.guesses} · Accuracy ${percent(right, match.guesses)}`);
}

function finishMatch(): void {
  const acc = percent(match.matched.size, match.guesses);
  const perfect = match.guesses === WHEEL_ORDER.length;
  $("more-result").textContent = perfect ? "Perfect — no wrong lines!" : `All twelve in ${match.guesses} guesses · ${acc} accuracy`;
  $("more-result").className = "good";
  announce($("more-result").textContent!);
  $("more-again").hidden = false;
  $("more-again").focus();
}

// Where a line meets an item: the inner edge, facing the other column.
function anchor(item: HTMLElement): { x: number; y: number } {
  const box = $("match").getBoundingClientRect();
  const r = item.getBoundingClientRect();
  const x = side(item) === "name" ? r.right : r.left;
  return { x: x - box.left, y: r.top + r.height / 2 - box.top };
}

function drawLine(id: string, from: { x: number; y: number }, to: { x: number; y: number }, tone: string): SVGLineElement {
  const svg = $("match-lines");
  let line = id ? svg.querySelector<SVGLineElement>(`#${id}`) : null;
  if (!line) {
    line = document.createElementNS(SVG_NS, "line");
    if (id) line.id = id;
    svg.appendChild(line);
  }
  line.setAttribute("class", tone);
  line.setAttribute("x1", String(from.x));
  line.setAttribute("y1", String(from.y));
  line.setAttribute("x2", String(to.x));
  line.setAttribute("y2", String(to.y));
  return line;
}

function redrawLines(): void {
  for (const [name, target] of match.matched) {
    const nameItem = $("match-names").querySelector<HTMLElement>(`[data-value="${name}"]`);
    if (nameItem) drawLine(`match-line-${name}`, anchor(nameItem), anchor(target), "right");
  }
}

// ---- Gender, Modality, Element: pick an answer for every sign, then submit ----

let sortGame: SortGame | null = null;

function startSort(g: SortGame): void {
  sortGame = g;
  $("match").hidden = true;
  $("sort").hidden = false;
  $("more-intro").textContent = g.intro;
  const list = $("sort");
  list.innerHTML = "";
  for (const name of shuffle(WHEEL_ORDER, Math.random)) {
    const sign = signByName(name);
    const row = document.createElement("li");
    row.dataset.name = name;
    row.innerHTML = `<fieldset><legend><span class="glyph" aria-hidden="true">${sign.glyph}${TEXT_STYLE}</span>${name}</legend>
      <div class="opts" data-count="${g.options.length}"></div></fieldset>`;
    const opts = row.querySelector(".opts")!;
    for (const opt of g.options) {
      const label = document.createElement("label");
      label.dataset.value = opt.value;
      const glyph = opt.glyph
        ? `<span class="glyph" aria-hidden="true"${opt.color ? ` style="color:${opt.color}"` : ""}>${opt.glyph}</span>`
        : "";
      label.innerHTML = `<input type="radio" name="sort-${name}" value="${opt.value}">${glyph}${opt.value}`;
      opts.appendChild(label);
    }
    list.appendChild(row);
  }
  list.onchange = renderSortProgress;
  $("more-submit").hidden = false;
  renderSortProgress();
}

function sortChoice(row: HTMLElement): string | null {
  return row.querySelector<HTMLInputElement>("input:checked")?.value ?? null;
}

function renderSortProgress(): void {
  const rows = [...$$<HTMLElement>("#sort li")];
  const done = rows.filter(r => sortChoice(r) !== null).length;
  setScore(`Answered ${done}/${rows.length}`);
  $<HTMLButtonElement>("more-submit").disabled = done < rows.length;
}

function submitSort(): void {
  const g = sortGame!;
  const rows = [...$$<HTMLElement>("#sort li")];
  let right = 0;
  for (const row of rows) {
    const correct = g.answer(signByName(row.dataset.name!));
    const choice = sortChoice(row);
    const ok = choice === correct;
    if (ok) right += 1;
    row.classList.add(ok ? "right" : "wrong");
    for (const input of row.querySelectorAll("input")) input.disabled = true;
    row.querySelector(`label[data-value="${correct}"]`)!.classList.add("answer");
    if (!ok) row.querySelector(`label[data-value="${choice}"]`)?.classList.add("picked");
  }
  const acc = percent(right, rows.length);
  setScore(`${right}/${rows.length} right · Accuracy ${acc}`);
  const all = right === rows.length;
  $("more-result").textContent = all ? `All twelve right!` : `${right} of ${rows.length} right. The correct ${g.label} is outlined in green.`;
  $("more-result").className = all ? "good" : "bad";
  announce(`${right} of ${rows.length} right, ${acc}.`);
  $("more-submit").hidden = true;
  $("more-again").hidden = false;
  $("more-again").focus();
}
