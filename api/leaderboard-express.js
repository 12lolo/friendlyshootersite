// Node/Express proxy to fetch Unity Leaderboards and return a simple entries array
// Usage: set env vars UGS_SERVERTOKEN, UGS_ORG_ID, UGS_PROJECT_ID, UGS_LEADERBOARD_ID
//        then `npm install` and `npm start` (or run with a process manager)

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function serveLocal(res, dataPath) {
  try {
    const fs = await import('fs/promises');
    const raw = await fs.readFile(dataPath, 'utf8');
    const json = JSON.parse(raw);
    if (Array.isArray(json)) return res.json({ entries: json });
    return res.json(json);
  } catch (err) {
    return res.json({ entries: [] });
  }
}

app.get('/api/leaderboard', async (req, res) => {
  const token = process.env.UGS_SERVERTOKEN || req.query.token || null;
  const org = process.env.UGS_ORG_ID || req.query.org || null;
  const project = process.env.UGS_PROJECT_ID || req.query.project || null;
  const leaderboard = process.env.UGS_LEADERBOARD_ID || req.query.leaderboard || null;

  const localPath = new URL('../webleaderboard/example-data.json', import.meta.url).pathname;

  if (!token || !org || !project || !leaderboard) {
    // not configured: serve local JSON
    try {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(localPath, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json)) return res.json({ entries: json });
      return res.json(json);
    } catch (err) {
      return res.json({ entries: [] });
    }
  }

  // Build UGS REST URL
  const ugsUrl = `https://leaderboards.services.api.unity.com/v1/organizations/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/leaderboards/${encodeURIComponent(leaderboard)}/scores?limit=100`;

  try {
    const r = await fetch(ugsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      timeout: 10000
    });
    if (!r.ok) {
      // fallback to local
      const fs = await import('fs/promises');
      const raw = await fs.readFile(localPath, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json)) return res.json({ entries: json });
      return res.json(json);
    }
    const json = await r.json();
    const results = json.results || json.entries || [];
    const entries = results.map(r => ({
      playerId: r.playerId || '',
      playerName: r.playerName || r.playerId || '',
      score: r.score ?? r.value ?? 0,
      timestamp: r.submittedAt ? Math.floor(new Date(r.submittedAt).getTime()/1000) : (r.createdAt ? Math.floor(new Date(r.createdAt).getTime()/1000) : Math.floor(Date.now()/1000))
    }));
    return res.json({ entries });
  } catch (err) {
    try {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(localPath, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json)) return res.json({ entries: json });
      return res.json(json);
    } catch (e) {
      return res.json({ entries: [] });
    }
  }
});

app.get('/api/health', (req,res) => res.json({ status: 'ok', time: Date.now() }));

// --- Simple admin API (password via header `x-admin-pass` or body/query `pass`) ---
const ADMIN_DATA_PATH = new URL('./admin-data.json', import.meta.url).pathname;

function checkAdminAuth(req, res, next) {
  const ADMIN_PASS = process.env.ADMIN_PASS || '8008';
  const provided = (req.headers['x-admin-pass'] || req.body?.password || req.query.pass || '').toString();
  if (provided !== ADMIN_PASS) return res.status(401).json({ error: 'unauthorized' });
  next();
}

async function readAdminData() {
  const fs = await import('fs/promises');
  try {
    const raw = await fs.readFile(ADMIN_DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const initial = { characters: [], enemies: [], maps: [] };
    await fs.writeFile(ADMIN_DATA_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

async function writeAdminData(data) {
  const fs = await import('fs/promises');
  await fs.writeFile(ADMIN_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

app.post('/api/admin/login', (req, res) => {
  const ADMIN_PASS = process.env.ADMIN_PASS || '8008';
  const provided = (req.body?.password || req.query.pass || '').toString();
  if (provided === ADMIN_PASS) return res.json({ ok: true });
  return res.status(401).json({ ok: false });
});

app.get('/api/admin/data', checkAdminAuth, async (req, res) => {
  const data = await readAdminData();
  return res.json(data);
});

app.get('/api/admin/items', checkAdminAuth, async (req, res) => {
  const type = (req.query.type || '').toString();
  const data = await readAdminData();
  if (!type) return res.json(data);
  const key = type === 'character' ? 'characters' : type === 'enemy' ? 'enemies' : type === 'map' ? 'maps' : null;
  if (!key) return res.status(400).json({ error: 'invalid type' });
  return res.json({ [key]: data[key] });
});

app.post('/api/admin/item', checkAdminAuth, async (req, res) => {
  const { type, item } = req.body || {};
  if (!type || !item) return res.status(400).json({ error: 'missing type or item' });
  const data = await readAdminData();
  const key = type === 'character' ? 'characters' : type === 'enemy' ? 'enemies' : type === 'map' ? 'maps' : null;
  if (!key) return res.status(400).json({ error: 'invalid type' });
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  const newItem = { id, ...item };
  data[key].push(newItem);
  await writeAdminData(data);
  return res.json(newItem);
});

app.put('/api/admin/item/:id', checkAdminAuth, async (req, res) => {
  const id = req.params.id;
  const { type, item } = req.body || {};
  if (!type || !item) return res.status(400).json({ error: 'missing type or item' });
  const data = await readAdminData();
  const key = type === 'character' ? 'characters' : type === 'enemy' ? 'enemies' : type === 'map' ? 'maps' : null;
  if (!key) return res.status(400).json({ error: 'invalid type' });
  const idx = data[key].findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  data[key][idx] = { id, ...item };
  await writeAdminData(data);
  return res.json(data[key][idx]);
});

app.delete('/api/admin/item/:id', checkAdminAuth, async (req, res) => {
  const id = req.params.id;
  const type = (req.query.type || req.body?.type || '').toString();
  if (!type) return res.status(400).json({ error: 'missing type' });
  const data = await readAdminData();
  const key = type === 'character' ? 'characters' : type === 'enemy' ? 'enemies' : type === 'map' ? 'maps' : null;
  if (!key) return res.status(400).json({ error: 'invalid type' });
  const idx = data[key].findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const removed = data[key].splice(idx, 1);
  await writeAdminData(data);
  return res.json({ removed: removed[0] });
});

app.listen(PORT, () => {
  console.log(`Leaderboard proxy listening on ${PORT}`);
});
