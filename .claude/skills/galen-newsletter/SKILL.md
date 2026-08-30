---
name: galen-newsletter
description: Draft and send Galen Marten Music newsletter emails through Resend using the site-branded template. Use whenever Galen or Danny wants to email the list, send a newsletter, announce a show/album/merch drop to subscribers, or "tell the list" something — even phrased casually ("let the list know the album's out", "send an email about Friday's show"). Always preview before sending; never send without explicit approval.
---

# Galen Marten Music newsletter

You turn a rough idea ("tell people about the album release show") into a branded,
ready-to-send email, show a preview, and only send after an explicit go-ahead.

## Voice

Write as Galen — first person, warm, plainspoken, a working musician talking to
friends who come to his shows. Short paragraphs. No marketing-speak, no hype
words ("epic", "amazing news!"), no emoji unless he asks. Sign-offs are simple:
"See you out there, — Galen" or similar.

## Workflow (never skip steps)

1. **Gather the message.** From whatever Galen/the user says, work out: the
   headline, 2-5 short paragraphs of body copy, an optional CTA (one button,
   e.g. "See the dates" → https://www.galenmartenmusic.com/shows/), an optional
   image, a subject line (plain, specific — "Live album out Nov 28" beats
   "Big news!"), and a one-line preheader. Draft them; don't interrogate the
   user with questions unless something essential is missing.
2. **Build the HTML.** Copy `assets/template.html` and replace the
   placeholders (see "Template placeholders" below). Escape user copy as HTML;
   convert paragraph breaks into the `<p>` snippet.
3. **Preview.** Chat panels sanitize HTML files (even data-URI images), so
   preview as an IMAGE: serve or open the built email in a real browser and
   screenshot it full-length, e.g.
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless
   --disable-gpu --screenshot=preview.png --window-size=700,2600
   --hide-scrollbars <file-or-url>` (adjust height to content; a temp copy can
   be dropped into the site's local dev server if file:// blocks remote images).
   Send the PNG to the user. Summarize alongside it: subject, preheader,
   audience, and CTA link target. Iterate until they're happy.
4. **Test send (offer it).** Offer to send a test to Galen's inbox
   (gsmarten@gmail.com) via the send script's `test` mode so he can see it in
   a real email client.
5. **Send — only on an explicit "send it".** Run the script's `broadcast`
   mode. Report the broadcast id and how many contacts the audience has.
   A preview shown in chat is NOT approval; wait for the words.

## Configuration

The send script needs:
- `RESEND_API_KEY` — from the environment, or from `config.json` next to this
  file (`{"api_key": "re_...", "audience_id": "...", "from": "Galen Marten Music <news@galenmartenmusic.com>"}`).
- `audience_id` — the Resend audience to send to.
- `from` — must be on a domain verified in Resend.

If any of these are missing, stop and tell the user exactly which one — do not
improvise a sender address.

## Template placeholders

- `{{SUBJECT}}` — subject line (also used for the broadcast).
- `{{PREHEADER}}` — one line, ≤90 chars, shows next to the subject in inboxes.
- `{{HEADLINE}}` — the big serif headline inside the email.
- `{{BODY}}` — one or more paragraph snippets:
  `<p style="margin:0 0 16px;font-family:'Azeret Mono','Courier New',Courier,monospace;font-size:14px;line-height:1.75;color:#242424;">TEXT</p>`
  Links inside body copy: `<a href="URL" style="color:#892B11;">text</a>`
- `{{IMAGE_BLOCK}}` — empty string, or:
  `<tr><td style="background-color:#FDFCE9;padding:8px 48px 20px;"><img src="URL" width="504" alt="ALT" style="display:block;border:0;width:100%;height:auto;border-radius:8px;"></td></tr>`
  Images must be absolute URLs, ideally hosted on the site (commit to
  `site/assets/img/` and push first if given a local file).
- `{{CTA_BLOCK}}` — empty string, or:
  `<tr><td style="background-color:#FDFCE9;padding:4px 48px 12px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#892B11;border-radius:6px;"><a href="URL" style="display:inline-block;padding:13px 26px;font-family:'Azeret Mono','Courier New',Courier,monospace;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#FDFCE9;text-decoration:none;">LABEL</a></td></tr></table></td></tr>`
- `{{SIGNOFF}}` — e.g. `See you out there,<br>— Galen`
- Leave `{{{RESEND_UNSUBSCRIBE_URL}}}` exactly as-is — Resend fills it at send
  time. Test sends via the `test` mode replace it with a placeholder link.

## Sending

Use `scripts/send.sh` (zero dependencies, curl):

```bash
# test send to one inbox (replaces unsubscribe var with #)
scripts/send.sh test "SUBJECT" built-email.html gsmarten@gmail.com

# create the broadcast in Resend (returns broadcast id) and send it
scripts/send.sh broadcast "SUBJECT" built-email.html
```

`broadcast` creates the broadcast against the configured audience and sends it
immediately. If the user wants it scheduled ("send tomorrow at 9am"), pass a
fourth argument with a natural-language time or ISO timestamp — Resend accepts
e.g. "in 1 hour" or "2026-11-28T09:00:00-05:00":

```bash
scripts/send.sh broadcast "SUBJECT" built-email.html "2026-11-28T09:00:00-05:00"
```

## Notes

- The template references fonts/images on https://www.galenmartenmusic.com
  (live since the Aug 2026 domain cutover).
- Audience size check: `scripts/send.sh audience` prints the contact count —
  useful in the pre-send summary.
- Never invent subscriber addresses; never send to ad-hoc lists. Broadcasts go
  to the configured audience only.
