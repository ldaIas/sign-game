// DOM helpers shared by the game modes.

export const $ = <E extends HTMLElement = HTMLElement>(id: string): E => document.getElementById(id) as E;
export const $$ = <E extends Element = HTMLButtonElement>(sel: string): NodeListOf<E> => document.querySelectorAll<E>(sel);

// `spoken` is what screen readers hear (defaults to the visible text). Classic
// and Timed append the score so score changes are announced too.
export function setPrompt(text: string, tone = "", spoken = text): void {
  $("prompt").textContent = text;
  $("prompt").className = tone;
  announce(spoken);
}

let announceToggle = false;
export function announce(text: string): void {
  // Alternate a trailing no-break space so a repeated message is still announced.
  announceToggle = !announceToggle;
  $("announcer").textContent = text + (announceToggle ? " " : "");
}
