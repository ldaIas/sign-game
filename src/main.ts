// App entry. The starfield goes first because a correct guess draws on it.

import { initFooter } from "./footer";
import { initGame } from "./game";
import { initInstall } from "./install";
import { initShare } from "./share";
import { initSky } from "./sky";

initSky();
initShare();
initGame();
initInstall();
initFooter();
