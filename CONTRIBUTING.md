# Contributing to Zodle

Bug reports, ideas and pull requests are welcome. Please open an [issue](https://github.com/ldaIas/sign-game/issues/new/choose) before a large change so we can agree on it first, and fill in the pull request checklist when you open a PR.

## Running it locally

There's no build step. The site lives in `public/`: open `public/index.html` in a browser, or run `npx wrangler dev` to preview it with the same headers as production.

When you change files in `public/`, bump `CACHE` in `public/sw.js` so installed copies pick up the new files.

## How it's put together

### Game and zodiac data

`public/signs.js` holds the sign data, `public/game.js` runs the Classic and Timed modes and `public/daily.js` the Daily puzzle. Daily progress and the streak are kept in `localStorage`. Sign boundaries use the common Western (tropical) zodiac dates; birthdays on a cusp follow those fixed dates.

### Starfield

`public/sky.js` draws the background. Stars near the mouse brighten when it's outside the play area, and a correct sign in any mode briefly pulls nearby stars into that sign's constellation.

### Installable app (PWA)

`public/manifest.webmanifest` describes the app and `public/sw.js` is a network-first service worker, so a new deploy is used whenever there's a connection and the last copy still opens offline. `public/install.js` shows an **Install** button in Chrome and Edge, and a short "Share → Add to Home Screen" hint on iPhone and iPad, since iOS has no install prompt. The hint stays hidden once it's dismissed or the app is running installed. To change the icon, edit `favicon.svg` and regenerate the PNGs (`icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`).

### Search and link previews

`public/index.html` carries the crawlable text as plain HTML: an About card under the title (hidden for good once dismissed; `public/about.js`) and one description per mode, shown by the mode switch. The `<head>` has a canonical URL, Open Graph and Twitter card tags, and JSON-LD (`VideoGame`). `public/robots.txt` and `public/sitemap.xml` point crawlers at `https://signs.idalas.com/`; bump the sitemap's `lastmod` when the page changes meaningfully. `public/og-image.png` (1200×630) is the link-preview image. The service worker leaves those three files to the network.

### Footer, privacy and accessibility

The footer is static HTML in `public/index.html`: an entertainment-only disclaimer, **Privacy** and **Accessibility** notices (`<details>` disclosures; `public/footer.js` makes them close on Escape or an outside click and opens one from a `#privacy` / `#accessibility` link), and a link to the GitHub issue forms. If the game starts storing anything new or adds a third-party request, update the Privacy text.

The game must stay playable by keyboard alone. Focus moves to the next sensible button when a guessed button is disabled, right/wrong results and score changes are announced through a visually hidden `aria-live` region (`#announcer`, filled by `announce()` in `game.js`), and animations and the starfield stop moving under `prefers-reduced-motion`.

### Issues, discussions and labels

`.github/ISSUE_TEMPLATE/` has issue forms for bugs, accessibility problems, ideas and wrong zodiac data, and each one applies its labels. `.github/DISCUSSION_TEMPLATE/general.yml` is the form for the General discussion category. The labels themselves are defined in `.github/labels.yml`. `.github/workflows/labels.yml` creates or updates them when that file changes on `main` (or when run by hand) and never deletes other labels.

## Deploying to Cloudflare

The site is served as static assets on Cloudflare Workers. `wrangler.jsonc` holds the config.

1. The subdomain is set in `wrangler.jsonc` under `routes` (`signs.idalas.com`). Its parent domain, `idalas.com`, has to be on your Cloudflare account.
2. Run:

   ```sh
   npx wrangler login     # first time only
   npx wrangler deploy
   ```

   Cloudflare creates the DNS record and TLS certificate for the subdomain.

`public/_headers` sets security headers (including a CSP) and makes browsers revalidate on each load, so a new deploy shows up right away.

### Deploying on every push to `main`

`.github/workflows/deploy.yml` runs `wrangler deploy` on every push to `main` (and can be run by hand from the Actions tab). It needs two repository secrets, set under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`: create one at **My Profile → API Tokens** from the **Edit Cloudflare Workers** template, scoped to your account and the `idalas.com` zone.
- `CLOUDFLARE_ACCOUNT_ID`: shown on the Workers & Pages overview page.

Don't also connect the repo through Cloudflare's own Git integration (Workers Builds), or each push will deploy twice.
