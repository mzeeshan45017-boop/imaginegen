require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const PORT = process.env.PORT || 8787;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not set. Generation requests will fail until you add it to server/.env');
}
if (!ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD is not set. The admin panel will refuse all logins until you set it in server/.env');
}

/*
 * ---- Site config (editable from the admin panel) ----
 * Stored as a JSON file so non-developers can change site copy, limits,
 * the blocked-word list, and the prompt library without touching code.
 * For a multi-server deployment, swap this file for a small database table.
 */
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');
function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

/*
 * ---- Very lightweight in-memory usage tracking ----
 * This is a DEMO ONLY. It resets whenever the server restarts and does not
 * survive multiple server instances. For a real product, replace this with
 * a database (e.g. Postgres/Redis) keyed on a real authenticated user id
 * from your auth provider, not a client-supplied header.
 */
const usage = new Map(); // key -> { count, day }
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function getUsage(key) {
  const day = todayKey();
  const entry = usage.get(key);
  if (!entry || entry.day !== day) {
    const fresh = { count: 0, day };
    usage.set(key, fresh);
    return fresh;
  }
  return entry;
}

function isPromptBlocked(prompt, blockedTerms) {
  const lower = prompt.toLowerCase();
  return blockedTerms.some((term) => lower.includes(term.toLowerCase()));
}

/* ---------------- Public: site content for the homepage ---------------- */
app.get('/api/site-config', (req, res) => {
  const cfg = loadConfig();
  res.json({
    heroTitle: cfg.heroTitle,
    heroSubtitle: cfg.heroSubtitle,
    promptLibrary: cfg.promptLibrary,
    freeGenerationsBeforeSignin: cfg.freeGenerationsBeforeSignin,
  });
});

/* ---------------- Public: generate ---------------- */
app.post('/api/generate', async (req, res) => {
  try {
    const cfg = loadConfig();
    const { prompt, aspectRatio, quantity, model, userId, signedIn } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A prompt is required.' });
    }
    if (isPromptBlocked(prompt, cfg.blockedTerms || [])) {
      return res.status(400).json({ error: 'This prompt isn\u2019t allowed. Please rephrase it.' });
    }

    const trackingKey = signedIn && userId ? `user:${userId}` : `anon:${req.ip}`;
    const entry = getUsage(trackingKey);
    const freeLimit = cfg.freeGenerationsBeforeSignin;
    const dailyCap = cfg.dailyGenerationCap;
    const limit = signedIn ? dailyCap : freeLimit;

    if (entry.count >= limit) {
      return res.status(429).json({
        error: signedIn
          ? `Daily limit reached (${dailyCap} images/day). Try again tomorrow.`
          : 'sign_in_required',
        signInRequired: !signedIn,
      });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. See server/.env.example.' });
    }

    const count = Math.min(Math.max(Number(quantity) || 1, 1), 4);
    const images = [];

    for (let i = 0; i < count; i++) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `Generate an image. Aspect ratio: ${aspectRatio || '1:1'}. ${prompt}` },
                ],
              },
            ],
          }),
        }
      );

      if (!geminiRes.ok) {
        const text = await geminiRes.text();
        console.error('Gemini API error:', geminiRes.status, text);
        return res.status(502).json({ error: 'Image generation failed upstream. Check server logs.' });
      }

      const data = await geminiRes.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData);
      if (imagePart) {
        images.push(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
      }
    }

    if (!images.length) {
      return res.status(502).json({ error: 'No image was returned. Try a different prompt.' });
    }

    entry.count += images.length;
    res.json({ images, remaining: Math.max(limit - entry.count, 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong generating your image.' });
  }
});

/* ---------------- Admin: auth ----------------
 * Simple single-password admin login, fine for one or two site owners.
 * For multiple admin users with different permissions, replace this with
 * real accounts (e.g. via the auth provider you use for regular users).
 */
function requireAdmin(req, res, next) {
  const token = req.header('x-admin-password');
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server has no ADMIN_PASSWORD configured.' });
  }
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server has no ADMIN_PASSWORD configured.' });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  res.json({ ok: true });
});

app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json(loadConfig());
});

app.post('/api/admin/config', requireAdmin, (req, res) => {
  const incoming = req.body || {};
  const current = loadConfig();
  const merged = {
    ...current,
    ...incoming,
  };
  saveConfig(merged);
  res.json({ ok: true, config: merged });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const day = todayKey();
  const rows = [];
  let total = 0;
  usage.forEach((entry, key) => {
    if (entry.day === day) {
      rows.push({ key, count: entry.count });
      total += entry.count;
    }
  });
  rows.sort((a, b) => b.count - a.count);
  res.json({ day, total, rows });
});

app.listen(PORT, () => {
  console.log(`ImagineGen server running on http://localhost:${PORT}`);
});
