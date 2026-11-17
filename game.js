const SIGN_GUESSES = 3;
// U+FE0E asks for the text form of the zodiac glyphs instead of colour emoji.
const TEXT_STYLE = "︎";

const $ = id => document.getElementById(id);

const state = {
  sign: null,
  guessesLeft: SIGN_GUESSES,
  phase: "sign", // "sign" | "element" | "done"
  score: 0,
  streak: 0,
};

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

function newRound() {
  const b = randomBirthday();
  state.sign = signFor(b.month, b.day);
  state.guessesLeft = SIGN_GUESSES;
  state.phase = "sign";

  $("birthday").textContent = `${MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  $("reveal").hidden = true;
  $("elements").hidden = true;
  $("signs").hidden = false;
  $("next").hidden = true;
  for (const btn of document.querySelectorAll(".grid button")) {
    btn.disabled = false;
    btn.classList.remove("wrong", "right");
  }
  setPrompt(guessesText());
}

function guessesText() {
  const n = state.guessesLeft;
  return `Which sign? ${n} guess${n === 1 ? "" : "es"} left`;
}

function setPrompt(text, tone = "") {
  $("prompt").textContent = text;
  $("prompt").className = tone;
}

function onSignGuess(btn) {
  if (state.phase !== "sign") return;
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
  const btn = document.querySelector(`#signs button[data-name="${state.sign.name}"]`);
  btn.classList.add("right");
}

function startElementBonus() {
  state.phase = "element";
  for (const btn of document.querySelectorAll("#signs button")) btn.disabled = true;
  $("elements").hidden = false;
  setPrompt(`${state.sign.name}! Bonus: which element? (1 guess)`, "good");
  updateStats();
}

function onElementGuess(btn) {
  if (state.phase !== "element") return;
  for (const b of document.querySelectorAll("#elements button")) b.disabled = true;

  const correct = state.sign.element;
  document.querySelector(`#elements button[data-name="${correct}"]`).classList.add("right");
  if (btn.dataset.name === correct) {
    state.score += 1;
    finishRound(`Yes — ${state.sign.name} is a ${correct} sign. +1 bonus`, "good");
  } else {
    btn.classList.add("wrong");
    finishRound(`Close — ${state.sign.name} is a ${correct} sign.`, "bad");
  }
}

function finishRound(message, tone) {
  state.phase = "done";
  for (const btn of document.querySelectorAll("#signs button")) btn.disabled = true;
  revealElement();
  setPrompt(message, tone);
  updateStats();
  $("next").hidden = false;
  $("next").focus();
}

function revealSign() {
  const s = state.sign;
  $("reveal-glyph").textContent = s.glyph + TEXT_STYLE;
  $("reveal-name").textContent = s.name;
  // The element stays hidden until the bonus question is answered.
  $("reveal-range").textContent = formatRange(s);
  $("reveal").hidden = false;
}

function revealElement() {
  const s = state.sign;
  $("reveal-range").textContent = `${formatRange(s)} · ${s.element}`;
}

function updateStats() {
  $("score").textContent = state.score;
  $("streak").textContent = state.streak;
}

$("next").addEventListener("click", newRound);

buildSignButtons();
buildElementButtons();
newRound();
