# Galen Marten Music — site repo

Static site for galenmartenmusic.com (musician Galen Marten: one-man band, Ohio).
No build step, no framework. Deployed via GitHub → Netlify auto-deploy; `netlify.toml` publishes the `site/` folder.

## Layout

- `site/` — everything that deploys. Plain HTML/CSS/JS.
  - `site/data/shows.json` — **the show list. This is the file that changes most.**
  - `site/data/products.json` — scraped product data (reference only; merch pages are static HTML).
  - `site/assets/img/shows/` — show/venue artwork images.
  - `site/assets/css/main.css` — the whole design system (tokens at top).
  - `site/assets/js/main.js` — nav, shows renderer, lazy YouTube, forms.
  - `site/merch/<slug>/index.html` — 9 static product pages.
- `Assets/` — client's source images/logos (not deployed). Don't delete.
- Pages share an identical header/footer block; if you edit nav or footer, apply the same edit to **every** `index.html` (grep for `site-header`).

## Adding a show (the routine — do this whenever the user gives concert info)

1. If an image was provided: convert/resize to webp ~1000px wide
   (`cwebp -q 80 in.jpg -o out.webp` or `ffmpeg`), name it something short,
   put it in `site/assets/img/shows/`. No image is fine too — the card renders without one.
2. Add an entry to the `shows` array in `site/data/shows.json`:
   - `venue` (shown big), `city`, `date` `"YYYY-MM-DD"`, `startTime24` `"18:00"`,
     optional `endTime24`, `address` (street address — powers Directions + calendar),
     `note` (one short line), `image` (`/assets/img/shows/<file>.webp`),
     optional `rsvpUrl` (external tickets/RSVP link — button appears only if present).
3. That's it. Past-dated shows disappear automatically (client-side date filter), so
   stale entries are harmless; prune them occasionally.
4. Commit. Do **not** push/deploy unless the user says to (see global instructions).

## Merch / print-on-demand (important context)

- Fulfillment: **Printful**, payments: **Stripe** — both were connected through the old
  Wix Stores setup. The product SKUs in `site/data/products.json` are Printful sync SKUs.
- Current buy flow: product pages link to the live **Wix** product page
  (`https://www.galenmartenmusic.com/product-page/<slug>` — every buy link carries
  `data-product-slug`). This works only while Wix still serves that domain.
  **Before the domain is pointed at Netlify**, either:
  a) move the Wix store to a subdomain (e.g. `shop.galenmartenmusic.com`) and update the
     buy hrefs, or
  b) build direct checkout: Stripe Checkout (payment links or a Netlify Function) +
     Printful API for order creation — needs the client's Printful API key + Stripe keys, or
  c) create a Printful hosted "quick store" and point buy links there.
- If you change the buy destination, update the `href`s in all `site/merch/*/index.html`
  (grep `buy-link`).

## Forms

- Contact form (`booking`) and newsletter (`newsletter`) are **Netlify Forms**
  (attribute-based, submissions appear in the Netlify dashboard). JS in `main.js`
  submits them via fetch and swaps in a success message.
- Planned: move storage to **Supabase** later (client wants contact + email list there).
  When that happens, replace the `data-ajax` handler target in `main.js`.

## Design system (keep it consistent)

- Fonts: Gloock (display serif) + Azeret Mono (everything else), self-hosted in `site/assets/fonts/`.
- Tokens in `:root` of main.css: `--ink #242424`, `--paper #FDFCE9`, `--paper-2 #F0EFDA`,
  `--leather #735A38`, `--mahogany #4F261B`, `--brick #892B11`, `--ember #ED7250`.
- The torn-paper divider is a CSS mask class: `<div class="torn bg-paper"></div>`
  (bg-* = color of the section the edge belongs to; add `style="transform:scaleY(-1)"`
  when it sits at the top of its section).
- YouTube embeds use the `.yt-lite` click-to-load facade (`data-yt="<video id>"`), never raw iframes.

## Gotchas

- `img { height: auto }` is set globally because width/height attributes otherwise
  override CSS `aspect-ratio`.
- New pages: copy an existing page's full HTML (e.g. `site/news/index.html`) to keep the
  shared header/footer; update `<title>`, meta description, canonical, and `sitemap.xml`.
- Local preview: `.claude/launch.json` → `npx serve -p 8899 site` (use the preview tool).
