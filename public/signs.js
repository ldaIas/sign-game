// Tropical zodiac. Each sign starts on [month, day] (1-based month) and runs
// until the day before the next sign's start.
const SIGNS = [
  { name: "Capricorn",   glyph: "♑", element: "Earth", start: [12, 22], end: [1, 19] },
  { name: "Aquarius",    glyph: "♒", element: "Air",   start: [1, 20],  end: [2, 18] },
  { name: "Pisces",      glyph: "♓", element: "Water", start: [2, 19],  end: [3, 20] },
  { name: "Aries",       glyph: "♈", element: "Fire",  start: [3, 21],  end: [4, 19] },
  { name: "Taurus",      glyph: "♉", element: "Earth", start: [4, 20],  end: [5, 20] },
  { name: "Gemini",      glyph: "♊", element: "Air",   start: [5, 21],  end: [6, 20] },
  { name: "Cancer",      glyph: "♋", element: "Water", start: [6, 21],  end: [7, 22] },
  { name: "Leo",         glyph: "♌", element: "Fire",  start: [7, 23],  end: [8, 22] },
  { name: "Virgo",       glyph: "♍", element: "Earth", start: [8, 23],  end: [9, 22] },
  { name: "Libra",       glyph: "♎", element: "Air",   start: [9, 23],  end: [10, 22] },
  { name: "Scorpio",     glyph: "♏", element: "Water", start: [10, 23], end: [11, 21] },
  { name: "Sagittarius", glyph: "♐", element: "Fire",  start: [11, 22], end: [12, 21] },
];

// Display order for the answer grid: the familiar Aries-first wheel.
const WHEEL_ORDER = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

const ELEMENTS = {
  Fire:  { glyph: "\u{1F702}", color: "#ff7a59" },
  Earth: { glyph: "\u{1F703}", color: "#8fbf6a" },
  Air:   { glyph: "\u{1F701}", color: "#9ecbff" },
  Water: { glyph: "\u{1F704}", color: "#6f8cff" },
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// Fire and Air signs are traditionally masculine; Earth and Water feminine.
const GENDERS = {
  Masculine: { glyph: "♂", elements: ["Fire", "Air"] },
  Feminine:  { glyph: "♀", elements: ["Earth", "Water"] },
};

for (const sign of SIGNS) {
  sign.gender = Object.keys(GENDERS).find(g => GENDERS[g].elements.includes(sign.element));
  sign.opposite = WHEEL_ORDER[(WHEEL_ORDER.indexOf(sign.name) + 6) % 12];
}

function signFor(month, day) {
  const key = month * 100 + day;
  return SIGNS.find(s => {
    const start = s.start[0] * 100 + s.start[1];
    const end = s.end[0] * 100 + s.end[1];
    // Capricorn wraps the new year, so its range is the union of two spans.
    return start <= end ? key >= start && key <= end : key >= start || key <= end;
  });
}

function signByName(name) {
  return SIGNS.find(s => s.name === name);
}

function randomBirthday() {
  const year = 1950 + Math.floor(Math.random() * 60);
  const dayOfYear = Math.floor(Math.random() * 365);
  const date = new Date(year, 0, 1 + dayOfYear);
  return { year, month: date.getMonth() + 1, day: date.getDate() };
}

function formatRange(sign) {
  const fmt = ([m, d]) => `${MONTHS[m - 1].slice(0, 3)} ${d}`;
  return `${fmt(sign.start)} – ${fmt(sign.end)}`;
}
