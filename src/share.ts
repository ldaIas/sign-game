// The "Copy result" button under a finished Daily or Timed game.

import { $, announce } from "./ui";

const SITE = "https://signs.idalas.com/";
let shareText = "";
let resetLabel: ReturnType<typeof setTimeout> | null = null;

export function showShare(text: string): void {
  shareText = `${text}\n${SITE}`;
  setLabel("Copy result");
  $("share").hidden = false;
}

export function hideShare(): void {
  $("share").hidden = true;
}

export function initShare(): void {
  $("share").addEventListener("click", async () => {
    const ok = await copy(shareText);
    setLabel(ok ? "Copied!" : "Couldn’t copy");
    announce(ok ? "Result copied to the clipboard." : "Couldn’t copy the result.");
    if (resetLabel !== null) clearTimeout(resetLabel);
    resetLabel = setTimeout(() => setLabel("Copy result"), 2000);
  });
}

function setLabel(text: string): void {
  $("share").textContent = text;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No async clipboard (older browsers, or http:// in development): fall back to a selection copy.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "visually-hidden";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
