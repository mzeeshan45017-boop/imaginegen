# Deploying ImagineGen — step by step

This walks you from "code on my computer" to "live website," using
**Render.com** because it has a free tier, deploys a Node app in a few
clicks, and needs no server management. The same steps work almost
identically on Railway, Fly.io, or a VPS if you prefer one of those.

---

## Step 0 — Get your Gemini API key ready

1. Go to https://aistudio.google.com/app/apikey
2. If you ever pasted a key anywhere public (a doc, a chat, a screenshot),
   delete it there and click **Create API key** to get a fresh one.
3. Copy the new key somewhere private (a password manager, not a text file
   you'll forget about). You'll paste it into Render in Step 4 — never into
   your code.

## Step 1 — Put the project in a GitHub repository

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository**, name it `imaginegen`, keep it **Private** for
   now, and click **Create repository**.
3. On your computer, inside the unzipped `imaginegen` folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/imaginegen.git
   git push -u origin main
   ```
   (No `git`? Install it from https://git-scm.com, or use GitHub Desktop's
   "Add local repository" instead of the commands above.)
4. **Double-check `.env` is not in the repo.** Add a file named `.gitignore`
   in the `server/` folder containing just:
   ```
   .env
   node_modules
   ```
   If you already committed a real `.env`, remove it and regenerate your
   API key — treat it as compromised the moment it touches a git history.

## Step 2 — Create a Render account

1. Go to https://render.com and sign up (you can sign up with GitHub, which
   makes the next step faster).
2. Authorize Render to access your GitHub repositories when prompted.

## Step 3 — Create the web service

1. In the Render dashboard, click **New +** → **Web Service**.
2. Select your `imaginegen` repository.
3. Fill in the settings:
   - **Name:** `imaginegen` (or whatever you like — this becomes part of
     your free `.onrender.com` URL)
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (fine for testing; upgrade before real traffic)
4. Don't click "Deploy" yet — first add the environment variables below.

## Step 4 — Add environment variables

Still on the same setup screen, scroll to **Environment Variables** and add:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | your key from Step 0 |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` (check Google's docs for the current name) |
| `ADMIN_PASSWORD` | a long, unique password for `/admin.html` |
| `PORT` | `10000` (Render sets this automatically too, but it's safe to include) |

Now click **Create Web Service**. Render will install dependencies, start
the server, and give you a URL like `https://imaginegen.onrender.com`
within a minute or two.

## Step 5 — Test it

1. Open the Render URL. You should see the ImagineGen homepage.
2. Type a prompt and click **Generate image**. If it fails, click **Logs**
   in the Render dashboard to see the error — the most common cause is a
   missing or incorrect `GEMINI_API_KEY`.
3. Go to `https://your-url.onrender.com/admin.html`, sign in with your
   `ADMIN_PASSWORD`, and confirm you can see usage stats and edit settings.

## Step 6 — Connect your own domain (optional)

1. Buy a domain (Namecheap, Google Domains, etc.) if you don't have one.
2. In Render, open your service → **Settings** → **Custom Domains** → **Add
   Custom Domain**, and enter your domain.
3. Render shows you a DNS record (usually a `CNAME`) to add. Go to your
   domain registrar's DNS settings and add exactly what Render shows.
4. Wait for DNS to propagate (a few minutes to a few hours) — Render will
   show the domain as **Verified** and issue an SSL certificate
   automatically.

## Step 7 — Before you submit for Google AdSense

1. Fill in every `[add ...]` placeholder in `privacy.html`, `terms.html`,
   `content-policy.html`, `help.html`, and `contact.html` (dates, a real
   support email).
2. Have someone review those legal pages — they're a starting template,
   not legal advice.
3. Make sure the site has been live for a little while with real content
   before applying; brand-new, mostly-empty sites are commonly rejected.
4. Apply at https://www.google.com/adsense and follow their site-verification
   steps (usually adding a small snippet to your page `<head>`, or a DNS
   record) once your account is approved.

## Updating the live site later

- **Content, limits, blocked words, prompt library:** edit them directly in
  `/admin.html` — no redeploy needed, changes save immediately.
- **Code changes:** commit and `git push` to `main`. Render redeploys
  automatically on every push (you can turn this off in Settings if you'd
  rather deploy manually).

## Common issues

| Symptom | Likely cause |
|---|---|
| "Server is missing GEMINI_API_KEY" | Env var not set, or typo in the name, in Render's dashboard |
| Admin login always says "Incorrect password" | `ADMIN_PASSWORD` env var not set, or you're using the old password after changing it (changing it requires a redeploy/restart) |
| Free tier "spins down" and the first request is slow | Normal behavior on Render's free tier after 15 minutes of no traffic — upgrade to a paid instance to avoid it |
| Images stop generating after a while | You likely hit Google's API quota/billing limit — check https://aistudio.google.com |
