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

## Merch / print-on-demand (direct checkout built, needs keys to activate)

- Fulfillment: **Printful**, payments: **Stripe**. Direct checkout is implemented:
  - `netlify/functions/create-checkout.mjs` — POST {variantId, quantity, slug} →
    looks the variant up in Printful (price source of truth) → Stripe Checkout
    Session → returns redirect URL. Flat US shipping via `SHIPPING_FLAT_CENTS`
    (default 499 = $4.99).
  - `netlify/functions/stripe-webhook.mjs` — verifies Stripe signature, then
    creates the Printful order (external_id = session id, idempotent). Orders are
    **drafts** unless `AUTO_CONFIRM_ORDERS=true`.
  - `site/assets/js/merch.js` — product pages fetch `/data/variants.json`; if the
    product has variants, the legacy buy link is replaced by size/color selects +
    a Buy now button. **If variants.json is missing, pages fall back to the old
    Wix product-page link** — nothing breaks without keys.
  - `tools/sync-printful-variants.mjs` — generates `site/data/variants.json` from
    the Printful store (run with PRINTFUL_API_KEY env; re-run when products change).
- **Activation checklist** (once the client provides keys):
  1. `netlify env:set PRINTFUL_API_KEY xxx` (+ `PRINTFUL_STORE_ID` if multi-store token)
  2. `netlify env:set STRIPE_SECRET_KEY sk_live_...`
  3. Create the Stripe webhook: POST /v1/webhook_endpoints for
     `<site>/.netlify/functions/stripe-webhook`, event `checkout.session.completed`,
     then `netlify env:set STRIPE_WEBHOOK_SECRET whsec_...`
  4. Run the variant sync script, commit variants.json, push.
  5. Test with Stripe test keys first; Printful orders stay drafts until
     `AUTO_CONFIRM_ORDERS=true` is set.
- The SKUs in `site/data/products.json` are Printful sync SKUs (Wix-era). Note:
  the Printful store is a Wix-connected store; if the client disconnects Wix from
  Printful, products must be recreated in a Printful "API/Manual" store and
  variants re-synced.

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

## SEO / performance conventions (keep these when editing)

- Every page head carries: canonical, full OG set (incl. og:site_name + image dims),
  twitter:title/description/image, and a JSON-LD block (WebPage; Product on merch
  pages; MusicGroup + WebSite on home). Copy the whole head pattern for new pages.
- `site/llms.txt`, `site/robots.txt`, `site/sitemap.xml` exist — add new pages to
  the sitemap and llms.txt.
- Show structured data (MusicEvent) is generated at runtime by main.js from
  shows.json — nothing to maintain.
- Images: webp, sized near their largest rendered size, `loading="lazy"` unless
  above the fold (then `fetchpriority="high"`), always width/height attrs.
  Homepage hero has a mobile srcset (`hero-1080.webp`) — regenerate both if the
  hero image changes.
- Cache headers live in netlify.toml: images/video 30d, css/js 1h+SWR (not
  content-hashed — don't set immutable), HTML must-revalidate.

## Gotchas

- `img { height: auto }` is set globally because width/height attributes otherwise
  override CSS `aspect-ratio`.
- New pages: copy an existing page's full HTML (e.g. `site/news/index.html`) to keep the
  shared header/footer; update `<title>`, meta description, canonical, and `sitemap.xml`.
- Local preview: `.claude/launch.json` → `npx serve -p 8899 site` (use the preview tool).
