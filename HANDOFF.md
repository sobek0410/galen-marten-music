# Galen Marten Music — project handoff

Working notes for picking this project back up in a fresh session. For *how the
code works*, read `CLAUDE.md` — this file covers **state, decisions, and what's
left to do**.

Last updated: 2026-08-12

---

## TL;DR

The new site is **built, optimized, and live on a staging URL** with auto-deploy.
The Wix site is still the public site at the real domain. Three things are
outstanding, all waiting on the client: **payment processor choice + Square keys**,
**GoDaddy DNS access**, and the **domain cutover**.

- **Staging:** https://galen-marten-music-staging.netlify.app
- **Repo:** https://github.com/sobek0410/galen-marten-music (public, `main`)
- **Old site (still live):** https://www.galenmartenmusic.com (Wix)

---

## ✅ Still to do

Keep this list current — check items off and add new ones as they come up.

### Blocked on Galen
- [ ] **Payment processor decision — Stripe or Square.** Leaning Square if he
      already uses it for at-show sales (one dashboard, one deposit stream).
      Checkout code is written for Stripe; swapping to Square is ~1 function
      rewrite (`netlify/functions/create-checkout.mjs` + webhook). Need:
      Square **access token** + **location ID** (sandbox first), or Stripe
      **secret key** (test first).
- [ ] **GoDaddy DNS credentials** → add 3 Resend records so email can send from
      `news@galenmartenmusic.com` (records listed below). Until then Resend can
      only send test emails to `gsmarten@gmail.com`.

### Blocked on the above
- [ ] **Finish merch checkout** once the processor is picked:
      1. Set the key(s) as Netlify env vars.
      2. Register the payment webhook → set its signing secret as an env var.
      3. Run `PRINTFUL_API_KEY=… node tools/sync-printful-variants.mjs`,
         commit `site/data/variants.json`, push. (This is what flips product
         pages from the Wix links to the real size/color picker.)
      4. Run a test purchase end-to-end → confirm a **draft** order appears in
         Printful. Only then set `AUTO_CONFIRM_ORDERS=true`.
- [ ] **Verify the Resend domain** after DNS is added, then change `from` in
      `~/.claude/skills/galen-newsletter/config.json` to
      `Galen Marten Music <news@galenmartenmusic.com>`.

### Launch day (domain cutover)
- [ ] Point `galenmartenmusic.com` DNS at Netlify; add the custom domain in the
      Netlify site settings (it provisions SSL automatically).
- [ ] **Merch buy links break at cutover.** They currently point at
      `https://www.galenmartenmusic.com/product-page/<slug>` (Wix). Either
      finish direct checkout first (preferred) or move the Wix store to a
      subdomain. Grep `buy-link` in `site/merch/*/index.html`.
- [ ] Update the email template URLs from the staging domain to
      `www.galenmartenmusic.com` (`~/.claude/skills/galen-newsletter/assets/template.html`,
      ~5 occurrences: fonts, wordmark, torn strip).
- [ ] Confirm Netlify Forms notifications go somewhere Galen actually reads
      (Netlify → Forms → notifications; add an email alert for `booking`).
- [ ] Only cancel Wix **after** cutover is confirmed working. Printful no longer
      depends on Wix (see below), but the live site does until DNS moves.

### Nice-to-have / later
- [ ] **Live Instagram feed.** The About page grid is a **static snapshot** of 6
      posts, not a live feed. Cheapest fix: [Behold.so](https://behold.so) free
      tier — Galen connects Instagram, we get a JSON feed URL, small JS change.
      Alternative: Meta Graph API (heavier, needs token refresh).
- [ ] Prune past shows from `site/data/shows.json` occasionally (they auto-hide,
      so this is cosmetic).
- [ ] Consider Stripe Tax / Square tax if merch volume ever justifies collecting
      sales tax (currently not collected — normal for this scale).
- [ ] Supabase was originally floated for form storage. **Currently not needed** —
      Netlify Forms handles capture, Resend owns the email list. Revisit only if
      Galen wants a real CRM.

---

## Current state

### Site
20 pages, no build step, deploys from `main` in ~15s. Home, shows, song list,
about, news, media, merch (+9 product pages), contact, 3 policy pages, 404,
merch/thanks.

- **Shows** are data-driven: edit `site/data/shows.json`, past dates auto-hide.
  This is the file that changes most — the routine is in `CLAUDE.md`.
- **SEO/perf pass done:** canonical + full OG/Twitter + JSON-LD on every page,
  `llms.txt`, sitemap, robots. Images optimized (site went 11.5MB → 7.3MB),
  responsive hero srcset, cache headers, zero console errors.
- **Design:** Gloock + Azeret Mono self-hosted, original palette, hero parallax,
  scroll reveals, torn-paper edge only on the homepage hero.

### Forms
`booking` (contact) and `newsletter` (footer) are **Netlify Forms** — submissions
appear in the Netlify dashboard. Newsletter signups **also auto-sync to Resend**
via `netlify/functions/submission-created.mjs` (verified end-to-end 2026-08-12).

### Merch / Printful — **migration complete**
All 9 products (232 variants) were cloned from the Wix-connected Printful store
into **"Galen's API Store" (id `18593964`)** with prices, print files, and
embroidery options intact. **Printful no longer depends on Wix.** A duplicate
"Live Free" tee was deleted. `PRINTFUL_API_KEY` + `PRINTFUL_STORE_ID` are set in
Netlify env.

Checkout code is written and deployed but **dormant** — product pages fall back
to the old Wix links until `variants.json` exists and payment keys are set.

### Email / Resend
- Audience **"General"** — `f3b4c006-7e8f-4d04-9325-f428029d72be`
- Branded HTML template + the **`galen-newsletter` Claude skill**
  (`~/.claude/skills/galen-newsletter/`, also packaged at `~/Desktop/galen-newsletter.skill`
  for uploading to Claude.ai → Settings → Skills).
- Workflow: describe the message → Claude drafts in Galen's voice → **screenshot
  preview** → optional test send → **explicit approval** → broadcast.
- Domain registered in Resend but **NOT verified** (DNS pending).

---

## Reference

### Accounts / IDs
| Thing | Value |
|---|---|
| Netlify site | `galen-marten-music-staging`, id `72184f46-ac99-444d-b8bd-aa9ff1c3d322` |
| Netlify team | "galen marten music" (`gsmarten@gmail.com`) |
| GitHub | `sobek0410/galen-marten-music` (public) |
| Printful store | Galen's API Store, id `18593964` |
| Resend audience | `f3b4c006-7e8f-4d04-9325-f428029d72be` |
| Galen's email | gsmarten@gmail.com |

**Netlify CLI gotcha:** `netlify login` authorizes whichever account is signed in
*in the browser*. It kept grabbing the Realeflow account — sign into Netlify as
Galen in the browser first, then `netlify logout && netlify login`.

**Repo is public** because Netlify's free tier won't build private repos pushed
by a non-team member. Nothing sensitive is in it (all keys are Netlify env vars
or local skill config).

### Secrets — where they live
Keys are **not** in the repo. They're in Netlify env vars (`PRINTFUL_API_KEY`,
`PRINTFUL_STORE_ID`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`) and in
`~/.claude/skills/galen-newsletter/config.json` (local only — excluded from the
packaged `.skill` file). A temporary Printful "Store Migration (all stores)"
token was created for the product migration and **can be deleted** from
developers.printful.com.

### Resend DNS records for GoDaddy
Add these on `galenmartenmusic.com`, then hit Verify in Resend:

| Type | Host | Value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey` | (long `p=MIGfMA0GCSqGSIb3…` DKIM key — copy from Resend dashboard → Domains) | — |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

---

## Decisions worth not re-litigating

- **Self-hosted hero video, not Wistia/YouTube.** Compressed 34MB → 1.4MB, only
  on `/media`. At ~70 sessions/month that's a rounding error against Netlify's
  100GB free tier, and an embed would add more JS than the video weighs.
- **Resend over Mailchimp/HubSpot.** It's AI-native (Claude can draft and send),
  free at this scale, and the list lives where the sending happens. Kit
  (ConvertKit) is the fallback if Galen ever wants a click-around dashboard.
- **Staging is crawlable, deliberately.** Every page's canonical points at
  `www.galenmartenmusic.com`, which is the standard way to keep a staging copy
  from ranking. A `noindex` header was considered and **rejected** — if it were
  forgotten at launch it would hide the real site from Google, a much worse
  failure than a brief duplicate.
- **Netlify Forms + Resend instead of Supabase.** Simpler, no database to run,
  and it covers everything Galen actually needs today.
