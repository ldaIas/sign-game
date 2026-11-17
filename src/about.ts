// The About card is plain HTML so search engines and first-time visitors see it.
// Once someone hides it, keep it hidden on later visits.
//
// This file is not part of the module bundle: vite.config.ts compiles it to a
// classic script loaded synchronously in <head>, so the class is set before the
// page paints and the card never flashes. Keep it free of imports.
(() => {
  const KEY = "sign-game:about-dismissed";
  try {
    if (localStorage.getItem(KEY) === "1") document.documentElement.classList.add("about-dismissed");
  } catch { /* private mode: just show the card */ }

  document.addEventListener("DOMContentLoaded", () => {
    const close = document.getElementById("about-close");
    if (!close) return;
    close.addEventListener("click", () => {
      document.documentElement.classList.add("about-dismissed");
      try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    });
  });
})();
