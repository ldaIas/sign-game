// App entry. The starfield goes first because a correct guess draws on it.

import { initFooter } from "./footer";
import { initGame } from "./game";
import { initInstall } from "./install";
import { initSky } from "./sky";

initSky();
initGame();
initInstall();
initFooter();
