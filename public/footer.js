// Footer disclosures (Privacy, Accessibility). They're plain <details>, so they
// work and are crawlable without this file; this just makes them behave like
// small popovers: one open at a time, Escape or a click elsewhere closes them,
// and a link to #privacy or #accessibility opens the matching one.
(() => {
  const pops = [...document.querySelectorAll("details.footer-pop")];

  for (const d of pops) {
    d.addEventListener("toggle", () => {
      if (d.open) for (const other of pops) if (other !== d) other.open = false;
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const open = pops.find(d => d.open);
    if (!open) return;
    open.open = false;
    open.querySelector("summary").focus();
  });

  document.addEventListener("click", event => {
    for (const d of pops) if (d.open && !d.contains(event.target)) d.open = false;
  });

  const openFromHash = () => {
    const d = pops.find(p => `#${p.id}` === location.hash);
    if (d) { d.open = true; d.querySelector("summary").focus(); }
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
