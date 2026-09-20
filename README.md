# ImagineGen

A one-page, mobile-responsive AI image generator: type a prompt, pick an aspect
ratio / quantity / model, and generate images with no watermark. Free tier is
5 images before "sign-in," then up to 100/day once signed in.

## ⚠️ Before you do anything else

The API key that was in your original notes has been **shared in plain text**
and should be treated as compromised:

1. Go to https://aistudio.google.com/app/apikey and **delete/regenerate** that key.
2. Only ever put the new key in `server/.env` (see below) — never in a chat,
   a doc, a screenshot, or committed to git.

## Project structure

```
imaginegen/
├── server/           Node/Express backend — the ONLY place your API key lives
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── public/           Static frontend served by the backend
    ├── index.html    The one-page generator + prompt library
    ├── privacy.html, terms.html, content-policy.html, help.html, contact.html, profile.html
    └── shared.css
```

Why a backend at all, given you asked for "1–2 steps, one page"? The page
itself is one step for the user. But an API key that generates images costs
you money per call — if it lived in the browser's JavaScript, anyone could
open dev tools, copy it, and run up your bill. The small server keeps the key
hidden and enforces your free-tier limits. It's the one piece of complexity
that can't safely be removed.

## Local setup

**Requirements:** Node.js 18 or later.

```bash
cd server
npm install
cp .env.example .env
# open .env and paste your NEW Gemini API key
npm start
```

Then open **http://localhost:8787** — the server also serves the frontend,
so there's nothing else to run.

## Admin panel

Open **http://localhost:8787/admin.html** and sign in with the
`ADMIN_PASSWORD` you set in `.env`. From there you can, without touching
code:

- Edit the homepage headline and subheading
- Change the free-generations-before-sign-in and daily-cap limits
- Edit the list of blocked words checked against every prompt
- Add, edit, or remove prompt library entries
- See today's generation count, overall and per user/visitor

Changes save to `server/data/config.json` and take effect immediately —
no restart needed. Keep that password private; anyone who has it can change
your site's limits and content.

## Environment variables (`server/.env`)

| Variable | Meaning |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key (required) |
| `GEMINI_IMAGE_MODEL` | Model id to call. Verify the current name in Google's docs before deploying — model names/availability change. |
| `PORT` | Port the server listens on (default 8787) |
| `FREE_GENERATIONS_BEFORE_SIGNIN` | Default 5 |
| `DAILY_GENERATION_CAP` | Default 100 |

## What's real vs. a placeholder in this build

This is a working prototype of the flow you described, not a production
system. Before you launch publicly:

- **Sign-in is simulated.** The "sign in" modal just asks for a name/email
  and stores an id in the browser's localStorage — it is *not* real
  authentication, and a user can clear their browser storage to reset their
  free count. For production, add a real auth provider (e.g. Firebase Auth,
  Auth0, or NextAuth) and track daily usage in a database keyed to the
  authenticated user id, not a client-supplied one.
- **Usage/rate-limit tracking is in-memory** (`server/server.js`). It resets
  when the server restarts and won't work correctly across multiple server
  instances. Replace with a database or Redis for anything beyond a demo.
- **Content moderation is a minimal keyword filter** on the prompt only.
  Your original plan called for both prompt- and image-level AI moderation.
  Before launch, put this behind a real moderation service (for example,
  Google's Perspective API or a dedicated image-safety classifier) and add
  a check on the *output* image, not just the input text.
- **Self-hosted Stable Diffusion / GPU infrastructure** from your original
  plan is a separate, much larger undertaking (provisioning GPU servers,
  a generation queue, autoscaling) than what's in this repo. This build
  uses the Gemini API instead so you have something working today; moving
  to self-hosted SDXL later means swapping out the `/api/generate` handler
  in `server.js` for calls to your own inference service — the frontend
  doesn't need to change.
- **AdSense pages** (`privacy.html`, `terms.html`, `content-policy.html`,
  `help.html`, `contact.html`) are drafted as templates with `[add ...]`
  placeholders (dates, contact email). Fill those in, and have a lawyer
  review the legal pages before submitting for ad-network approval.

## Deploying

See **[DEPLOY.md](./DEPLOY.md)** for a full step-by-step walkthrough
(GitHub → Render → environment variables → custom domain → AdSense
checklist). Short version: any Node host works (Render, Railway, Fly.io, a
VPS) — push the repo, set the environment variables in the host's
dashboard, set the start command to `npm start` inside `server/`, and point
your domain at the deployed URL.

## Packaging

A zip of this whole project is provided alongside this README so you can
hand it to a developer or upload it directly to a host.
