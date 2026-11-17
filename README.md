# Sign Game

A small browser quiz: you're shown a birthday and have to name its sun sign.

- **Classic** — 3 guesses per birthday. Get it right and you earn a bonus question: name the sign's element (1 guess).
- **Timed** — 60 seconds, 1 point per correct sign, one guess per birthday.
- **Daily** — one birthday a day, the same for everyone (picked from the player's local date). Answer five questions in order: sign, symbol, gender, element, opposite sign. Each question appears only once the previous one is answered. You get 5 misses across the whole puzzle; run out and every answer is revealed. Wrong sign guesses get an "N signs ahead/behind" hint. Progress and the day streak (consecutive days solved) are kept in `localStorage`.

There's no build step. The site lives in `public/`: open `public/index.html` in a browser.

Sign boundaries use the common tropical-zodiac dates; birthdays that fall on a cusp follow those fixed dates.

## Deploying to Cloudflare

The site is served as static assets on Cloudflare Workers. `wrangler.jsonc` holds the config.

1. The subdomain is set in `wrangler.jsonc` under `routes` (`signs.idalas.com`). Its parent domain, `idalas.com`, has to be on your Cloudflare account.
2. Run:

   ```sh
   npx wrangler login     # first time only
   npx wrangler deploy
   ```

   Cloudflare creates the DNS record and TLS certificate for the subdomain.

To preview locally with the same headers: `npx wrangler dev`.

`public/_headers` sets security headers (including a CSP) and makes browsers revalidate on each load, so a new deploy shows up right away.

### Deploying on every push (optional)

In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**, then pick this repo. Leave the build command empty and keep the deploy command as `npx wrangler deploy`.
