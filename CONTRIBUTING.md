# Contributing to Zodle

Bug reports, ideas and pull requests are welcome. Please open an [issue](https://github.com/ldaIas/sign-game/issues/new/choose) before a large change so we can agree on it first, and fill in the pull request checklist when you open a PR.

## License for contributions

By submitting a contribution, you agree that it is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE), like the rest of the project, and that Sam Sovereign may also use, change, distribute and license it under any other terms, including commercial ones. You confirm that you have the right to grant this.

## Running it locally

The site is TypeScript built with [Vite](https://vite.dev/). You need Node.js (the current LTS).

```sh
npm install
npm run dev       # dev server with live reload (no service worker)
npm test          # Vitest unit tests
npm run build     # type-check, then build into dist/
npm run preview   # serve dist/ locally
npx wrangler dev  # build, then serve dist/ with the production headers (CSP included)
```

Check changes under `npx wrangler dev` before opening a PR: it's the only local server that applies `public/_headers`, so it's where a CSP violation would show up.

## How it's put together

- `index.html`: the page. Vite's entry point; its `<script type="module">` loads `src/main.ts`.
- `src/`: TypeScript sources (ES modules) and `style.css`.
- `public/`: files served unchanged at the site root: `_headers`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, the icons, `og-image.png`.
- `tests/`: Vitest tests. `tests/fixtures/baseline.json` pins the Daily puzzle output (see below).
- `dist/`: the build output that Cloudflare serves. Not committed.

### Game and zodiac data

`src/signs.ts` holds the sign data, `src/game.ts` runs the mode switch and the Classic and Timed modes, and `src/daily.ts` the Daily screen. The Daily rules live in `src/puzzle.ts`, which has no DOM code so it can be unit-tested. Daily progress and the streak are kept in `localStorage` (`src/storage.ts`). Sign boundaries use the common Western (tropical) zodiac dates; birthdays on a cusp follow those fixed dates.

Each day's puzzle is generated from a seed made from the date, so everyone gets the same one and saved guesses can be replayed after a reload. Never change the seed string, the order of the `rand()` calls or the shuffle in `src/puzzle.ts`: that would change the live puzzle and break players' saved progress. `tests/puzzle.test.ts` checks the output for a set of dates against `tests/fixtures/baseline.json`.

### Starfield

`src/sky.ts` draws the background. Stars near the mouse brighten when it's outside the play area, and a correct sign in any mode briefly pulls nearby stars into that sign's constellation.

### Installable app (PWA)

`public/manifest.webmanifest` describes the app. `src/sw.ts` is a network-first service worker, so a new deploy is used whenever there's a connection and the last copy still opens offline:

- Same-origin GET requests go to the network first; successful responses are cached, and the cached copy is used when the network fails. An offline page load falls back to the cached `index.html`.
- `robots.txt`, `sitemap.xml` and `og-image.png` always go to the network (see below).
- On install it caches the app shell: the built HTML, JS and CSS, plus `favicon.svg`, the manifest and `icon-192.png`.

[vite-plugin-pwa](https://vite-pwa-org.netlify.app/) builds it to `/sw.js` (`injectManifest` strategy, configured in `vite.config.ts`) and fills in the list of built files and their revisions. The cache is named after that list, so every deploy that changes a file gets a fresh cache and the worker deletes the old ones when it activates; there's no version number to bump. The worker is registered from `src/install.ts` in production builds only, so `npm run dev` runs without it.

`src/install.ts` also shows an **Install** button in Chrome and Edge, and a short "Share → Add to Home Screen" hint on iPhone and iPad, since iOS has no install prompt. The hint stays hidden once it's dismissed or the app is running installed. To change the icon, edit `favicon.svg` and regenerate the PNGs (`icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`).

### Search and link previews

`index.html` carries the crawlable text as plain HTML: an About card under the title (hidden for good once dismissed; `src/about.ts`) and one description per mode, shown by the mode switch. The `<head>` has a canonical URL, Open Graph and Twitter card tags, and JSON-LD (`VideoGame`). `public/robots.txt` and `public/sitemap.xml` point crawlers at `https://signs.idalas.com/`; bump the sitemap's `lastmod` when the page changes meaningfully. `public/og-image.png` (1200×630) is the link-preview image. The service worker leaves those three files to the network.

`src/about.ts` has to run before the page first paints, or a dismissed card would flash on load, so it isn't part of the module bundle (module scripts run only after the page is parsed). A small plugin in `vite.config.ts` compiles it to a classic script and adds it to the `<head>`. Keep it free of imports.

### Footer, privacy and accessibility

The footer is static HTML in `index.html`: an entertainment-only disclaimer, **Privacy** and **Accessibility** notices (`<details>` disclosures; `src/footer.ts` makes them close on Escape or an outside click and opens one from a `#privacy` / `#accessibility` link), and a link to the GitHub issue forms. If the game starts storing anything new or adds a third-party request, update the Privacy text.

The game must stay playable by keyboard alone. Focus moves to the next sensible button when a guessed button is disabled, right/wrong results and score changes are announced through a visually hidden `aria-live` region (`#announcer`, filled by `announce()` in `src/ui.ts`), and animations and the starfield stop moving under `prefers-reduced-motion`.

### Issues, discussions and labels

`.github/ISSUE_TEMPLATE/` has issue forms for bugs, accessibility problems, ideas and wrong zodiac data, and each one applies its labels. `.github/DISCUSSION_TEMPLATE/` has forms for the General and Ideas discussion categories; a rough idea starts in Ideas and becomes a feature request issue that links back to it. The labels themselves are defined in `.github/labels.yml`. `.github/workflows/labels.yml` creates or updates them when that file changes on `main` (or when run by hand) and never deletes other labels.

## Deploying to Cloudflare

The site is served as static assets on Cloudflare Workers. `wrangler.jsonc` holds the config: it serves `./dist`, and its `build` section makes `wrangler deploy` and `wrangler dev` run `npm run build` first.

1. The subdomain is set in `wrangler.jsonc` under `routes` (`signs.idalas.com`). Its parent domain, `idalas.com`, has to be on your Cloudflare account.
2. Run:

   ```sh
   npx wrangler login     # first time only
   npx wrangler deploy
   ```

   Cloudflare creates the DNS record and TLS certificate for the subdomain.

`public/_headers` sets security headers (including a CSP) and makes browsers revalidate on each load, so a new deploy shows up right away.

### Deploying on every push to `main`

`.github/workflows/deploy.yml` runs on every push to `main` (and can be run by hand from the Actions tab): it installs dependencies with `npm ci`, runs the tests, then runs `wrangler deploy`, which builds the site. A failing test stops the deploy. It needs two repository secrets, set under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`: create one at **My Profile → API Tokens** from the **Edit Cloudflare Workers** template, scoped to your account and the `idalas.com` zone.
- `CLOUDFLARE_ACCOUNT_ID`: shown on the Workers & Pages overview page.

Don't also connect the repo through Cloudflare's own Git integration (Workers Builds), or each push will deploy twice.

### Previews for pull requests

`.github/workflows/preview.yml` runs on every pull request. It runs the tests and the build. For a branch in this repository, it then uploads that build as a new Worker version with `wrangler versions upload --preview-alias pr-<number>` and comments its URL on the PR (`https://pr-<number>-sign-game.<subdomain>.workers.dev`). Uploading a version doesn't deploy it, so `signs.idalas.com` keeps serving `main`. Preview builds add `X-Robots-Tag: noindex` to `_headers` so search engines skip them.

PRs from forks get the tests and build but no preview: GitHub gives their runs no secrets. Keep the trigger as `pull_request`; `pull_request_target` would run a fork's code with the Cloudflare token. Preview URLs are under `workers.dev`, so they add nothing to the `idalas.com` zone, and Cloudflare drops the least recently used aliases on its own past its limit.
