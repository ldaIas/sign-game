// Background starfield drawn on a canvas.
// - Stars twinkle faintly on their own.
// - Outside the play area, stars near the pointer brighten, and fade back slowly.
// - constellation(name) pulls the nearest stars into that sign's figure for a
//   moment, then lets them drift home.

type Point = [number, number];

interface Shape {
  points: Point[];
  lines: [number, number][];
}

// Approximate stick figures. Points are [x, y] in a unit box (y grows downward);
// lines are pairs of point indexes. Shapes follow the usual IAU-style figures
// closely enough to be recognisable; they aren't star-chart accurate.
const CONSTELLATIONS: Record<string, Shape> = {
  Aries: {
    points: [[0, 0.35], [0.55, 0.45], [0.85, 0.65], [0.92, 0.82]],
    lines: [[0, 1], [1, 2], [2, 3]],
  },
  Taurus: {
    points: [[0.6, 0.62], [0.48, 0.46], [0.38, 0.32], [0.05, 0.05], [0.5, 0.62],
      [0.4, 0.54], [0, 0.42], [0.78, 0.85], [1, 0.3]],
    lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [0, 7]],
  },
  Gemini: {
    points: [[0.2, 0], [0.15, 0.35], [0.1, 0.65], [0, 0.95], [0.48, 0.05],
      [0.47, 0.4], [0.42, 0.7], [0.36, 1], [0.6, 0.62]],
    lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [0, 4], [1, 5], [5, 8]],
  },
  Cancer: {
    points: [[0.5, 0.55], [0.45, 0.35], [0.35, 0], [0.2, 0.95], [0.9, 0.85]],
    lines: [[0, 1], [1, 2], [0, 3], [0, 4]],
  },
  Leo: {
    points: [[0.75, 0.75], [0.72, 0.52], [0.7, 0.32], [0.8, 0.16], [0.9, 0.12],
      [0.98, 0.25], [0.32, 0.6], [0, 0.66], [0.3, 0.4]],
    lines: [[5, 4], [4, 3], [3, 2], [2, 1], [1, 0], [0, 6], [6, 7], [7, 8], [8, 2], [8, 6]],
  },
  Virgo: {
    points: [[0.55, 0.98], [0.5, 0.72], [0.4, 0.5], [0.2, 0.45], [0, 0.4],
      [0.5, 0.33], [0.55, 0.08], [0.72, 0.6], [0.95, 0.5], [0.85, 0.92]],
    lines: [[4, 3], [3, 2], [2, 1], [1, 0], [2, 5], [5, 6], [5, 7], [1, 7], [7, 8], [7, 9]],
  },
  Libra: {
    points: [[0, 0.45], [0.55, 0], [0.88, 0.38], [0.12, 0.92], [0.72, 0.75], [0.66, 0.95]],
    lines: [[0, 1], [1, 2], [0, 2], [0, 3], [2, 4], [4, 5]],
  },
  Scorpio: {
    points: [[0.15, 0], [0.1, 0.12], [0.06, 0.26], [0.27, 0.24], [0.35, 0.35],
      [0.42, 0.46], [0.5, 0.6], [0.5, 0.75], [0.56, 0.88], [0.68, 0.96],
      [0.85, 0.93], [0.95, 0.8], [0.88, 0.7], [1, 0.64]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
      [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
  },
  Sagittarius: {
    points: [[0.3, 0.88], [0.36, 0.6], [0.42, 0.38], [0.08, 0.66], [0.56, 0.54],
      [0.78, 0.48], [0.8, 0.74], [0.6, 0.8], [0.95, 0.4]],
    lines: [[3, 1], [1, 0], [3, 0], [1, 2], [2, 4], [1, 4], [4, 5], [5, 6],
      [6, 7], [7, 4], [7, 0], [5, 8]],
  },
  Capricorn: {
    points: [[0, 0.1], [0.08, 0.26], [0.2, 0.7], [0.27, 0.9], [0.55, 0.76],
      [0.78, 0.55], [0.98, 0.3], [0.86, 0.34], [0.68, 0.33], [0.5, 0.3]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 1]],
  },
  Aquarius: {
    points: [[0, 0.22], [0.35, 0.15], [0.5, 0.22], [0.6, 0.14], [0.66, 0.02],
      [0.72, 0.2], [0.4, 0.45], [0.55, 0.6], [0.45, 0.86], [0.72, 0.76], [0.88, 1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [1, 6], [6, 7], [7, 8], [7, 9], [9, 10]],
  },
  Pisces: {
    points: [[0.45, 1], [0.4, 0.72], [0.35, 0.46], [0.3, 0.2], [0.18, 0.04],
      [0.36, 0], [0.62, 0.92], [0.76, 0.85], [0.86, 0.78], [0.92, 0.66],
      [1, 0.58], [0.95, 0.48], [0.86, 0.5], [0.83, 0.6]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 3], [0, 6], [6, 7],
      [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 9]],
  },
};

interface Star {
  homeX: number; homeY: number;
  x: number; y: number;
  tx: number; ty: number;
  size: number;
  base: number;
  phase: number;
  speed: number;
  tint: string;
  glow: number;
  lit: number; // extra brightness while part of a constellation
}

interface Figure {
  stars: Star[];
  lines: [number, number][];
  label: string | null;
  labelX: number;
  labelY: number;
  bold: boolean;
  until: number;
  released?: boolean;
}

let sky: { constellation: (name: string) => void } | null = null;

/** Pulls stars into the named sign's figure. Does nothing before initSky() or under reduced motion. */
export function constellation(name: string): void {
  sky?.constellation(name);
}

export function initSky(): void {
  const canvas = document.createElement("canvas");
  canvas.id = "sky";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d")!;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const HOVER_RADIUS = 170;
  const FORM_MS = 1000;   // how long the constellation holds before scattering
  const TINTS = ["255,255,255", "207,212,255", "255,233,176"];

  let stars: Star[] = [];
  let width = 0, height = 0;
  let pointer: { x: number; y: number } | null = null; // while the pointer is outside the play area
  let figure: Figure | null = null;
  let figureFade = 0;      // 0..1, drives line and label opacity
  let last = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(380, Math.round((width * height) / 5200));
    stars = Array.from({ length: count }, () => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      return {
        homeX: x, homeY: y, x, y, tx: x, ty: y,
        size: Math.random() < 0.12 ? 1.7 : 0.8 + Math.random() * 0.6,
        base: 0.38 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2,
        tint: TINTS[Math.random() < 0.7 ? 0 : 1 + (Math.random() < 0.5 ? 1 : 0)],
        glow: 0,
        lit: 0,
      };
    });
    figure = null;
    figureFade = 0;
    if (reducedMotion.matches) draw(performance.now());
  }

  // The play area is <main>'s content; the pointer only counts when it's outside it.
  function playArea() {
    const main = document.querySelector("main")!;
    const r = main.getBoundingClientRect();
    return { left: r.left + 8, right: r.right - 8, top: r.top, bottom: r.bottom };
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    const a = playArea();
    const inside = e.clientX > a.left && e.clientX < a.right && e.clientY > a.top && e.clientY < a.bottom;
    pointer = inside ? null : { x: e.clientX, y: e.clientY };
  }

  // Where a figure fits: an empty side gutter on wide screens, otherwise centred.
  function figureBox(): { cx: number; cy: number; size: number; behindCard?: boolean } {
    const a = playArea();
    const leftGap = a.left, rightGap = width - a.right;
    const gap = Math.max(leftGap, rightGap);
    if (gap >= 200) {
      const size = Math.min(gap * 0.72, height * 0.55, 340);
      const cx = rightGap >= leftGap ? a.right + rightGap / 2 : leftGap / 2;
      return { cx, cy: height * 0.45, size };
    }
    // No room beside the game: draw it behind the (translucent) card instead.
    const card = document.getElementById("card")!.getBoundingClientRect();
    const size = Math.min(card.width * 0.8, card.height * 0.92);
    return { cx: card.left + card.width / 2, cy: card.top + card.height / 2, size, behindCard: true };
  }

  function constellation(name: string) {
    const shape = CONSTELLATIONS[name];
    if (!shape || reducedMotion.matches || !stars.length) return;
    release();

    const { cx, cy, size, behindCard } = figureBox();
    const xs = shape.points.map(p => p[0]), ys = shape.points.map(p => p[1]);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    const scale = size / Math.max(spanX, spanY);
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;

    // Each point claims the nearest free star, so the gathering looks local.
    const taken = new Set<Star>();
    const chosen = shape.points.map(([px, py]) => {
      const tx = cx + (px - midX) * scale;
      const ty = cy + (py - midY) * scale;
      let best: Star | null = null, bestD = Infinity;
      for (const s of stars) {
        if (taken.has(s)) continue;
        const d = (s.homeX - tx) ** 2 + (s.homeY - ty) ** 2;
        if (d < bestD) { bestD = d; best = s; }
      }
      const star = best!;
      taken.add(star);
      star.tx = tx;
      star.ty = ty;
      return star;
    });

    figure = {
      stars: chosen,
      lines: shape.lines,
      label: behindCard ? null : name, // the card already shows the name
      labelX: cx,
      labelY: cy + (spanY * scale) / 2 + 28,
      // The card covers most of a figure drawn behind it, so draw that one bolder.
      bold: !!behindCard,
      until: performance.now() + FORM_MS + 500,
    };
    kick();
  }

  function release() {
    if (!figure) return;
    for (const s of figure.stars) { s.tx = s.homeX; s.ty = s.homeY; }
    figure.released = true;
  }

  function step(now: number) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    if (figure && !figure.released && now > figure.until) release();

    const move = 1 - Math.exp(-dt * 5);
    const forming = figure && !figure.released;
    figureFade += ((forming ? 1 : 0) - figureFade) * (1 - Math.exp(-dt * (forming ? 3 : 6)));
    if (figure && figure.released && figureFade < 0.01) figure = null;

    const inFigure = new Set(figure && !figure.released ? figure.stars : []);
    for (const s of stars) {
      s.x += (s.tx - s.x) * move;
      s.y += (s.ty - s.y) * move;
      s.lit += ((inFigure.has(s) ? 1 : 0) - s.lit) * (1 - Math.exp(-dt * 4));

      let target = 0;
      if (pointer) {
        const d = Math.hypot(s.x - pointer.x, s.y - pointer.y);
        if (d < HOVER_RADIUS) target = (1 - d / HOVER_RADIUS) ** 2;
      }
      // Brighten quickly, fade slowly, so the light trails behind the pointer.
      s.glow += (target - s.glow) * (1 - Math.exp(-dt * (target > s.glow ? 10 : 1.6)));
    }
    draw(now);
  }

  function draw(now: number) {
    ctx.clearRect(0, 0, width, height);
    const t = now / 1000;
    const still = reducedMotion.matches;

    if (figure && figureFade > 0.01) {
      ctx.strokeStyle = `rgba(243,210,122,${(figure.bold ? 0.95 : 0.45) * figureFade})`;
      ctx.lineWidth = figure.bold ? 2.5 : 1.25;
      ctx.beginPath();
      for (const [a, b] of figure.lines) {
        ctx.moveTo(figure.stars[a].x, figure.stars[a].y);
        ctx.lineTo(figure.stars[b].x, figure.stars[b].y);
      }
      ctx.stroke();
      if (figure.label) {
        ctx.fillStyle = `rgba(243,210,122,${0.55 * figureFade})`;
        ctx.font = "600 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(figure.label.toUpperCase().split("").join(" "), figure.labelX, figure.labelY);
      }
    }

    const boldLit = figure && figure.bold;
    for (const s of stars) {
      const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(t * s.speed * (1 + s.glow * 3) + s.phase);
      const alpha = Math.min(1, s.base * twinkle + s.glow * 0.75 + s.lit * 0.6);
      const r = s.size * (1 + s.glow * 0.9 + s.lit * (boldLit ? 1.8 : 0.8));
      ctx.fillStyle = `rgba(${s.lit > 0.3 ? "255,233,176" : s.tint},${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (s.glow > 0.15 || s.lit > 0.15) {
        const halo = Math.max(s.glow, s.lit);
        ctx.fillStyle = `rgba(${s.tint},${(boldLit && s.lit > 0.15 ? 0.3 : 0.12) * halo})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Animate continuously unless reduced motion is on; then draw once per change.
  let running = false;
  function loop(now: number) {
    step(now);
    if (!reducedMotion.matches) requestAnimationFrame(loop);
    else running = false;
  }
  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer = null; });
  reducedMotion.addEventListener?.("change", () => { resize(); kick(); });

  resize();
  kick();
  sky = { constellation };
}
