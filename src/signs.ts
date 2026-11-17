export type ElementName = "Fire" | "Earth" | "Air" | "Water";
export type GenderName = "Masculine" | "Feminine";
export type ModalityName = "Cardinal" | "Fixed" | "Mutable";
export type PlanetName = "Sun" | "Moon" | "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn"
  | "Uranus" | "Neptune" | "Pluto";
/** [month, day], 1-based month. */
export type MonthDay = readonly [number, number];

export interface Sign {
  name: string;
  glyph: string;
  element: ElementName;
  start: MonthDay;
  end: MonthDay;
  gender: GenderName;
  opposite: string;
  modality: ModalityName;
  ruler: PlanetName;
}

export interface Birthday {
  year: number;
  month: number;
  day: number;
}

// U+FE0E asks for the text form of the zodiac glyphs instead of colour emoji.
export const TEXT_STYLE = "︎";

// Display order for the answer grid: the familiar Aries-first wheel.
export const WHEEL_ORDER = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

export const ELEMENTS: Record<ElementName, { glyph: string; color: string }> = {
  Fire:  { glyph: "\u{1F702}", color: "#ff7a59" },
  Earth: { glyph: "\u{1F703}", color: "#8fbf6a" },
  Air:   { glyph: "\u{1F701}", color: "#9ecbff" },
  Water: { glyph: "\u{1F704}", color: "#6f8cff" },
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// Fire and Air signs are traditionally masculine; Earth and Water feminine.
export const GENDERS: Record<GenderName, { glyph: string; elements: ElementName[] }> = {
  Masculine: { glyph: "♂", elements: ["Fire", "Air"] },
  Feminine:  { glyph: "♀", elements: ["Earth", "Water"] },
};

// Signs cycle Cardinal, Fixed, Mutable around the wheel, starting with Aries.
export const MODALITIES: ModalityName[] = ["Cardinal", "Fixed", "Mutable"];

// In the usual order, with glyphs. Venus and Mars share their glyphs with the genders.
export const PLANETS: Record<PlanetName, { glyph: string }> = {
  Sun: { glyph: "☉" }, Moon: { glyph: "☽" }, Mercury: { glyph: "☿" }, Venus: { glyph: "♀" },
  Mars: { glyph: "♂" }, Jupiter: { glyph: "♃" }, Saturn: { glyph: "♄" }, Uranus: { glyph: "♅" },
  Neptune: { glyph: "♆" }, Pluto: { glyph: "♇" },
};

// Modern rulers. Scorpio, Aquarius and Pisces had Mars, Saturn and Jupiter before
// the outer planets were found; hints mention those so the old answer isn't a mystery.
export const TRADITIONAL_RULERS: Partial<Record<string, PlanetName>> = {
  Scorpio: "Mars", Aquarius: "Saturn", Pisces: "Jupiter",
};

type SignBase = Omit<Sign, "gender" | "opposite" | "modality">;

// Tropical zodiac. Each sign starts on [month, day] and runs until the day
// before the next sign's start.
const SIGN_DATES: SignBase[] = [
  { name: "Capricorn",   glyph: "♑", element: "Earth", start: [12, 22], end: [1, 19], ruler: "Saturn" },
  { name: "Aquarius",    glyph: "♒", element: "Air",   start: [1, 20],  end: [2, 18], ruler: "Uranus" },
  { name: "Pisces",      glyph: "♓", element: "Water", start: [2, 19],  end: [3, 20], ruler: "Neptune" },
  { name: "Aries",       glyph: "♈", element: "Fire",  start: [3, 21],  end: [4, 19], ruler: "Mars" },
  { name: "Taurus",      glyph: "♉", element: "Earth", start: [4, 20],  end: [5, 20], ruler: "Venus" },
  { name: "Gemini",      glyph: "♊", element: "Air",   start: [5, 21],  end: [6, 20], ruler: "Mercury" },
  { name: "Cancer",      glyph: "♋", element: "Water", start: [6, 21],  end: [7, 22], ruler: "Moon" },
  { name: "Leo",         glyph: "♌", element: "Fire",  start: [7, 23],  end: [8, 22], ruler: "Sun" },
  { name: "Virgo",       glyph: "♍", element: "Earth", start: [8, 23],  end: [9, 22], ruler: "Mercury" },
  { name: "Libra",       glyph: "♎", element: "Air",   start: [9, 23],  end: [10, 22], ruler: "Venus" },
  { name: "Scorpio",     glyph: "♏", element: "Water", start: [10, 23], end: [11, 21], ruler: "Pluto" },
  { name: "Sagittarius", glyph: "♐", element: "Fire",  start: [11, 22], end: [12, 21], ruler: "Jupiter" },
];

export const SIGNS: Sign[] = SIGN_DATES.map(sign => ({
  ...sign,
  gender: (Object.keys(GENDERS) as GenderName[]).find(g => GENDERS[g].elements.includes(sign.element))!,
  opposite: WHEEL_ORDER[(WHEEL_ORDER.indexOf(sign.name) + 6) % 12],
  modality: MODALITIES[WHEEL_ORDER.indexOf(sign.name) % 3],
}));

export function signFor(month: number, day: number): Sign {
  const key = month * 100 + day;
  return SIGNS.find(s => {
    const start = s.start[0] * 100 + s.start[1];
    const end = s.end[0] * 100 + s.end[1];
    // Capricorn wraps the new year, so its range is the union of two spans.
    return start <= end ? key >= start && key <= end : key >= start || key <= end;
  })!;
}

export function signByName(name: string): Sign {
  return SIGNS.find(s => s.name === name)!;
}

export function randomBirthday(): Birthday {
  const year = 1950 + Math.floor(Math.random() * 60);
  const dayOfYear = Math.floor(Math.random() * 365);
  const date = new Date(year, 0, 1 + dayOfYear);
  return { year, month: date.getMonth() + 1, day: date.getDate() };
}

export function formatRange(sign: Sign): string {
  const fmt = ([m, d]: MonthDay) => `${MONTHS[m - 1].slice(0, 3)} ${d}`;
  return `${fmt(sign.start)} – ${fmt(sign.end)}`;
}

/**
 * True on the first two or last two days of a sign, where people most often
 * mix up the sign (and the exact change shifts a day between years).
 */
export function isNearCusp(month: number, day: number): boolean {
  // A leap year, so Feb 29 has a place; no sign changes in February's last days.
  const dayOfYear = (m: number, d: number) => Math.round((Date.UTC(2000, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000);
  const today = dayOfYear(month, day);
  return SIGNS.some(s => {
    const offset = (today - dayOfYear(...s.start) + 366) % 366;
    return offset <= 1 || offset >= 364;
  });
}
