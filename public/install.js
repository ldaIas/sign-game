// "Add to home screen" support: registers the service worker and shows an
// install button (Chromium browsers) or a how-to hint (iOS, Firefox for Android).
(() => {
  const DISMISS_KEY = "sign-game:install-dismissed";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* not fatal */ });
    });
  }

  const box = document.getElementById("install");
  const text = document.getElementById("install-text");
  const btn = document.getElementById("install-btn");
  const close = document.getElementById("install-close");

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let dismissed = false;
  try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* private mode */ }
  if (standalone || dismissed) return;

  const hide = () => { box.hidden = true; };
  close.addEventListener("click", () => {
    hide();
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode */ }
  });

  // Chromium (Android Chrome, desktop Chrome/Edge): a real install button.
  let deferred = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferred = event;
    text.textContent = "Play Zodle like an app.";
    btn.hidden = false;
    box.hidden = false;
  });
  btn.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    hide();
  });
  window.addEventListener("appinstalled", hide);

  // iOS has no install prompt, so explain the Share-sheet route instead.
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) {
    text.innerHTML = 'Add Zodle to your home screen: tap <span class="share" aria-label="Share">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</span> then <b>Add to Home Screen</b>.';
    box.hidden = false;
  }

  // Firefox for Android has no install prompt either; point to its menu item.
  if (/Android/.test(ua) && /Firefox\//.test(ua)) {
    text.innerHTML = 'Add Zodle to your home screen: open the <b>⋮</b> menu, then ' +
      '<b>More</b> → <b>Add app to Home screen</b>.';
    box.hidden = false;
  }
})();
