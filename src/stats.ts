// Saved bests for Classic and Timed, and the Stats dialog that shows them with
// the Daily history.

import { DAILY_HISTORY_KEY, bestStreak, currentStreak, dailyStats, localDateKey, type DailyHistory } from "./puzzle";
import { loadItem, loadJSON, saveItem, saveJSON } from "./storage";
import { $ } from "./ui";

const TIMED_BEST_KEY = "sign-game:timed-best";
const CLASSIC_BEST_KEY = "sign-game:classic-best";

interface ClassicBest {
  score: number;
  streak: number;
}

export function timedBest(): number {
  return Number(loadItem(TIMED_BEST_KEY)) || 0;
}

export function saveTimedBest(score: number): void {
  saveItem(TIMED_BEST_KEY, String(score));
}

export function classicBest(): ClassicBest {
  const saved = loadJSON<ClassicBest>(CLASSIC_BEST_KEY);
  return { score: saved?.score || 0, streak: saved?.streak || 0 };
}

/** Keeps the highest Classic score and streak seen. */
export function recordClassic(score: number, streak: number): void {
  const best = classicBest();
  if (score <= best.score && streak <= best.streak) return;
  saveJSON(CLASSIC_BEST_KEY, { score: Math.max(score, best.score), streak: Math.max(streak, best.streak) });
}

export function initStats(): void {
  const dialog = $<HTMLDialogElement>("stats-dialog");
  $("stats-open").addEventListener("click", () => {
    renderStats();
    dialog.showModal();
  });
  $("stats-close").addEventListener("click", () => dialog.close());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
}

function renderStats(): void {
  const today = localDateKey(new Date());
  const history = loadJSON<DailyHistory>(DAILY_HISTORY_KEY) || {};
  const daily = dailyStats(history);
  const classic = classicBest();

  setTiles("daily-tiles", [
    ["Played", daily.played],
    ["Win %", daily.played ? Math.round((daily.won / daily.played) * 100) : 0],
    ["Streak", currentStreak(today)],
    ["Best streak", bestStreak()],
  ]);
  setTiles("classic-tiles", [["Best score", classic.score], ["Best streak", classic.streak]]);
  setTiles("timed-tiles", [["Best score", timedBest()]]);

  const rows: [label: string, spoken: string, count: number, lost: boolean][] = [
    ...daily.byMisses.map((n, i) => [String(i), `${i} miss${i === 1 ? "" : "es"}`, n, false] as [string, string, number, boolean]),
    ["✗", "Out of guesses", daily.lost, true],
  ];
  const most = Math.max(1, ...rows.map(r => r[2]));
  const todays = history[today];
  const chart = $("miss-chart");
  chart.innerHTML = "";
  for (const [label, spoken, count, lost] of rows) {
    const li = document.createElement("li");
    const isToday = !!todays && (lost ? !todays.won : todays.won && todays.misses === Number(label));
    li.className = `${lost ? "lost" : ""}${isToday ? " today" : ""}`;
    li.innerHTML = `<span class="key" aria-hidden="true"></span><span class="bar"><span></span></span>
      <span class="visually-hidden"></span>`;
    li.querySelector(".key")!.textContent = label;
    li.querySelector<HTMLElement>(".bar > span")!.style.width = `${(count / most) * 100}%`;
    li.querySelector<HTMLElement>(".bar > span")!.textContent = String(count);
    li.querySelector(".visually-hidden")!.textContent = `${spoken}: ${count}${isToday ? ", including today" : ""}`;
    li.querySelector(".bar")!.setAttribute("aria-hidden", "true");
    chart.appendChild(li);
  }
  $("miss-chart-empty").hidden = daily.played > 0;
  chart.hidden = daily.played === 0;
}

function setTiles(id: string, tiles: [label: string, value: number][]): void {
  const box = $(id);
  box.innerHTML = "";
  for (const [label, value] of tiles) {
    const div = document.createElement("div");
    div.innerHTML = `<span class="value"></span><span class="label"></span>`;
    div.querySelector(".value")!.textContent = String(value);
    div.querySelector(".label")!.textContent = label;
    box.appendChild(div);
  }
}
