# Setting up on a new computer

For getting this project running on a machine that's never had it — written so
Claude Code can walk someone non-technical through it. Work top to bottom.

**Audience note:** Galen is a musician, not a developer. Explain what each step
does in plain language, run the commands yourself rather than asking him to, and
don't assume he knows git. Never paste secrets into the chat.

---

## 1. Prerequisites

Check what's already there before installing anything:

```bash
git --version; gh --version; node --version
```

- **git** — usually already on macOS; if missing, running `git --version` prompts
  to install Apple's Command Line Tools. Accept it.
- **gh** (GitHub CLI) — makes signing in to GitHub painless.
  `brew install gh`, or download from https://cli.github.com
- **node** — only needed for the Printful variant sync script. Optional;
  skip unless merch products change. https://nodejs.org (LTS)

## 2. GitHub

```bash
gh auth login
```

Choose: GitHub.com → HTTPS → authenticate in browser. Sign in as **Galen's**
GitHub account (the one invited as a collaborator — the invite must be accepted
first, check https://github.com/notifications).

Verify he can actually reach the repo:

```bash
gh repo view sobek0410/galen-marten-music
```

## 3. Clone the project

```bash
cd ~/Documents
gh repo clone sobek0410/galen-marten-music "Galen Marten Music"
cd "Galen Marten Music"
```

Then confirm push access works — this is the thing that matters most:

```bash
git commit --allow-empty -m "Verify push access from Galen's machine"
git push
```

If that succeeds, he can publish changes. If it 403s, the collaborator invite
hasn't been accepted yet.

## 4. Netlify (optional but useful)

Not needed for day-to-day edits — pushing to `main` deploys automatically.
Useful for checking deploy status or changing environment variables.

```bash
npm install -g netlify-cli   # or: brew install netlify-cli
netlify login
```

⚠️ `netlify login` authorizes whichever account is signed in **in the browser**.
Make sure that's Galen's Netlify (gsmarten@gmail.com) before authorizing.

Then link this folder to the site:

```bash
netlify link --id 72184f46-ac99-444d-b8bd-aa9ff1c3d322
```

## 5. Resend (only if sending newsletters from this machine)

The newsletter skill lives in this repo at `.claude/skills/galen-newsletter/`
and Claude Code loads it automatically here. It needs an API key, which is
deliberately **not** in the repo.

1. Go to https://resend.com/api-keys (Galen's account), create a key with
   **Full access**, copy it.
2. Create the config file — Claude should write this, and must **not** echo the
   key back into the chat:

```bash
cp .claude/skills/galen-newsletter/config.example.json \
   .claude/skills/galen-newsletter/config.json
```

Then edit `config.json` so it reads:

```json
{
  "api_key": "re_...",
  "audience_id": "f3b4c006-7e8f-4d04-9325-f428029d72be",
  "from": "Galen Marten Music <news@galenmartenmusic.com>"
}
```

`config.json` is gitignored, so the key never leaves the machine.

Sanity check (should print the subscriber count):

```bash
.claude/skills/galen-newsletter/scripts/send.sh audience
```

## 6. Confirm everything works

```bash
git log --oneline -3          # sees project history
netlify status                # correct account + linked site (if step 4 done)
```

And open the site locally to be sure the preview works:
`.claude/launch.json` defines a dev server on port 8899 (`npx serve -p 8899 site`).

---

## Day-to-day, once set up

Galen just talks to Claude in this folder. The common ones:

- **"Add a show"** + the details and a photo → Claude edits
  `site/data/shows.json`, optimizes the image, commits.
- **"Push it live"** → Claude pushes to `main`; Netlify deploys in ~15 seconds.
- **"Email the list about X"** → the newsletter skill drafts it, shows a preview
  image, and only sends after he explicitly approves.

He never needs to run a deploy command — pushing *is* deploying.

Read `CLAUDE.md` for how the code is organized and `HANDOFF.md` for current
project state and what's still outstanding.
