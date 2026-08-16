# Galen Marten Music — site repo

> **Picking this up fresh?** Read [HANDOFF.md](HANDOFF.md) first — it has current
> project state, what's still outstanding, and account/ID reference. This file
> covers how the code works.

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

## Merch / print-on-demand (LIVE — production Square, auto-fulfilling)

- Fulfillment: **Printful**, payments: **Square**. Direct checkout is implemented
  and was verified end-to-end in sandbox (Aug 2026) before the production
  credentials went in:
  - `netlify/functions/create-checkout.mjs` — POST {variantId, quantity, slug} →
    looks the variant up in Printful (price source of truth) → Square hosted
    Payment Link → returns redirect URL. Printful variant/slug/qty ride along in
    Square **order metadata**. Flat US shipping as a service charge via
    `SHIPPING_FLAT_CENTS` (default 499 = $4.99).
  - `netlify/functions/square-webhook.mjs` — verifies Square's HMAC signature
    (base64 HMAC-SHA256 of notificationUrl + rawBody), fetches the paid order for
    metadata + the buyer's shipping address, creates the Printful order
    (external_id = Square order id, idempotent). Orders are **drafts** unless
    `AUTO_CONFIRM_ORDERS=true`.
    (Stripe versions of both live in git history before commit ba33f67 if the
    processor ever changes back.)
  - `site/assets/js/merch.js` — product pages fetch `/data/variants.json`; if the
    product has variants, the legacy buy link is replaced by size/color selects +
    a Buy now button. **If variants.json is missing, pages fall back to the old
    Wix product-page link** — nothing breaks without keys.
  - `tools/sync-printful-variants.mjs` — generates `site/data/variants.json` from
    the Printful store (run with PRINTFUL_API_KEY env; re-run when products change).
- **Env vars set in Netlify:** `PRINTFUL_API_KEY`, `PRINTFUL_STORE_ID`,
  `SQUARE_ACCESS_TOKEN` (production), `SQUARE_LOCATION_ID` (`L1VFAPBYS526B`),
  `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL`, `SQUARE_ENV`
  (`production`), `AUTO_CONFIRM_ORDERS` (`true`).
- **`AUTO_CONFIRM_ORDERS=true`** — orders go straight to fulfillment, no manual
  approval. Deliberate: Galen doesn't monitor the Printful dashboard, so drafts
  would rot and customers would pay for nothing. He has a card on file and
  Printful auto-deposits to his wallet, so confirmed orders charge cleanly.
  Oversight comes from email: Printful mails him per order, Square per payment.
  A Square payment email with no matching Printful email = something broke.
- **Square webhook subscriptions:** production
  `wbhk_edc219c05850457c8ea53a82fc726b82`, sandbox
  `wbhk_0b336a6bd6df4b99bb8a7e662e78adc3`. Both notify the *staging*
  netlify.app function URL, which keeps working after the domain cutover — but
  if it's ever changed, update BOTH the Square subscription and the
  `SQUARE_WEBHOOK_URL` env var (signature verification hashes that exact URL).
- **NOT yet done: one real production test order.** Checkout is only reachable
  on the staging URL, so no customer can hit it before cutover. Place one small
  real order before launch to prove the chain with real money.
- Re-run `PRINTFUL_API_KEY=… node tools/sync-printful-variants.mjs` and commit
  `site/data/variants.json` whenever products change in Printful.
- **Store migration DONE (Aug 2026):** all 9 products were cloned from the
  Wix-connected Printful store into "Galen's API Store" (PRINTFUL_STORE_ID
  18593964) with full variants, prices, print files, and embroidery options.
  The new site is fully independent of Wix on the Printful side.
  PRINTFUL_API_KEY (store-scoped) + PRINTFUL_STORE_ID are set in Netlify env.
  (A manually-created duplicate Live Free tee was deleted Aug 2026; the store
  holds exactly the 9 migrated products.)

## Newsletter / email (Resend)

- List + sending: **Resend** (Galen's account). Audience "General"
  (`f3b4c006-7e8f-4d04-9325-f428029d72be`). Env vars RESEND_API_KEY (secret)
  + RESEND_AUDIENCE_ID are set in Netlify.
- `netlify/functions/submission-created.mjs` auto-adds newsletter form
  signups to the audience (booking submissions are excluded — no consent).
  Verified end-to-end Aug 2026.
- Composing/sending happens through the **galen-newsletter skill**
  (~/.claude/skills/galen-newsletter): branded template, preview-first,
  explicit approval before broadcast. Config lives in the skill dir
  (never commit keys to this repo).
- Domain galenmartenmusic.com is registered in Resend but NOT yet verified —
  DNS records (DKIM TXT resend._domainkey, MX+TXT on send) need to be added
  in GoDaddy; until then sends come from onboarding@resend.dev. After
  verification, switch the skill config 'from' to news@galenmartenmusic.com.

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
