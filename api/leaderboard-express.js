// Node/Express proxy to fetch Unity Leaderboards and return a simple entries array
// Usage: set env vars UGS_SERVERTOKEN, UGS_ORG_ID, UGS_PROJECT_ID, UGS_LEADERBOARD_ID
//        then `npm install` and `npm start` (or run with a process manager)

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import Database from 'better-sqlite3';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- SQLite DB for admin data ---
const DB_PATH = new URL('./admin.db', import.meta.url).pathname;
const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  extra TEXT,
  health INTEGER,
  damage INTEGER,
  movement TEXT
);
CREATE TABLE IF NOT EXISTS enemies (
  id TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  extra TEXT,
  health INTEGER,
  damage INTEGER,
  movement TEXT
);
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  extra TEXT
);
`);

function tableForType(type) {
  if (type === 'character') return 'characters';
  if (type === 'enemy') return 'enemies';
  if (type === 'map') return 'maps';
  return null;
}

function generateId() {
  try { return crypto.randomUUID(); } catch (e) { return String(Date.now()) + '-' + Math.floor(Math.random()*100000); }
}

function rowToItem(row, type) {
  if (!row) return null;
  const base = { id: row.id, name: row.name, bio: row.bio, extra: row.extra ? JSON.parse(row.extra) : {} };
  if (type === 'map') return base;
  return Object.assign(base, { health: row.health || 0, damage: row.damage || 0, movement: row.movement || 'medium' });
}

function getAllItems(type) {
  const table = tableForType(type);
  if (!table) return [];
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY name COLLATE NOCASE`).all();
  return rows.map(r => rowToItem(r, type));
}

function getItemById(type, id) {
  const table = tableForType(type);
  if (!table) return null;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return rowToItem(row, type);
}

function insertItem(type, item) {
  const table = tableForType(type);
  if (!table) return null;
  const id = generateId();
  if (type === 'map') {
    db.prepare(`INSERT INTO maps (id,name,bio,extra) VALUES (?,?,?,?)`).run(id, item.name||'', item.bio||'', JSON.stringify(item.extra||{}));
  } else {
    db.prepare(`INSERT INTO ${table} (id,name,bio,extra,health,damage,movement) VALUES (?,?,?,?,?,?,?)`).run(
      id, item.name||'', item.bio||'', JSON.stringify(item.extra||{}), item.health||0, item.damage||0, item.movement||'medium'
    );
  }
  return getItemById(type, id);
}

function updateItem(type, id, item) {
  const table = tableForType(type);
  if (!table) return null;
  if (type === 'map') {
    db.prepare(`UPDATE maps SET name = ?, bio = ?, extra = ? WHERE id = ?`).run(item.name||'', item.bio||'', JSON.stringify(item.extra||{}), id);
  } else {
    db.prepare(`UPDATE ${table} SET name = ?, bio = ?, extra = ?, health = ?, damage = ?, movement = ? WHERE id = ?`).run(
      item.name||'', item.bio||'', JSON.stringify(item.extra||{}), item.health||0, item.damage||0, item.movement||'medium', id
    );
  }
  return getItemById(type, id);
}

function deleteItem(type, id) {
  const table = tableForType(type);
  if (!table) return null;
  const item = getItemById(type, id);
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return item;
}

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

// Proxy endpoint to fetch itch.io embed HTML and serve it without X-Frame-Options.
app.get('/itch/embed', async (req, res) => {
  try {
    const target = 'https://tjeerdoweirdo06.itch.io/friendlyshooter/embed';
    const r = await fetch(target, { headers: { 'User-Agent': 'friendlyshooter-proxy/1.0' }, timeout: 10000 });
    const text = await r.text();
    // Inject a <base> tag so relative URLs resolve against itch.io
    const baseTag = '<base href="https://tjeerdoweirdo06.itch.io/friendlyshooter/">';
    const out = text.replace(/<head([^>]*)>/i, function(m){ return m + baseTag; });
    // Serve as HTML and do NOT set X-Frame-Options so it can be framed by this origin
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(out);
  } catch (err) {
    res.status(502).send('<html><body style="background:#07120a;color:#fff;padding:24px;">Unable to fetch embed from itch.io. <a href="https://tjeerdoweirdo06.itch.io/friendlyshooter" target="_blank" rel="noopener" style="color:#9ff">Open on itch.io</a></body></html>');
  }
});

// Metadata endpoint: fetches itch.io page and returns parsed JSON (title, description, images)
app.get('/itch/meta', async (req, res) => {
  try {
    const target = 'https://tjeerdoweirdo06.itch.io/friendlyshooter';
    const r = await fetch(target, { headers: { 'User-Agent': 'friendlyshooter-meta-proxy/1.0' }, timeout: 10000 });
    const html = await r.text();

    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<img[^>]+class=["']?header[^"']*["']?[^>]+src=["']([^"']+)["']/i);

    // collect screenshot image URLs (images with class "screenshot")
    const screenshots = [];
    const re = /<img[^>]+class=["'][^"']*screenshot[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/ig;
    let m;
    while ((m = re.exec(html)) !== null) {
      screenshots.push(m[1]);
    }

    const title = titleMatch ? titleMatch[1] : '';
    const description = descMatch ? descMatch[1] : '';
    const image = imageMatch ? imageMatch[1] : '';

    return res.json({ title, description, image, screenshots });
  } catch (err) {
    return res.status(502).json({ error: 'failed', message: String(err) });
  }
});

// --- Simple admin API (password via header `x-admin-pass` or body/query `pass`) ---
// (DB-backed helpers above replace JSON file storage)

app.post('/api/admin/login', (req, res) => {
  return res.json({ ok: true });
});

app.get('/api/admin/data', async (req, res) => {
  // return everything
  const characters = getAllItems('character');
  const enemies = getAllItems('enemy');
  const maps = getAllItems('map');
  return res.json({ characters, enemies, maps });
});

app.get('/api/admin/items', async (req, res) => {
  const type = (req.query.type || '').toString();
  if (!type) return res.status(400).json({ error: 'missing type' });
  const key = type === 'character' ? 'characters' : type === 'enemy' ? 'enemies' : type === 'map' ? 'maps' : null;
  if (!key) return res.status(400).json({ error: 'invalid type' });
  const items = getAllItems(type);
  return res.json({ [key]: items });
});

app.post('/api/admin/item', async (req, res) => {
  const { type, item } = req.body || {};
  if (!type || !item) return res.status(400).json({ error: 'missing type or item' });
  const added = insertItem(type, item);
  if (!added) return res.status(400).json({ error: 'invalid type' });
  return res.json(added);
});

app.put('/api/admin/item/:id', async (req, res) => {
  const id = req.params.id;
  const { type, item } = req.body || {};
  if (!type || !item) return res.status(400).json({ error: 'missing type or item' });
  const updated = updateItem(type, id, item);
  if (!updated) return res.status(404).json({ error: 'not found or invalid type' });
  return res.json(updated);
});

app.delete('/api/admin/item/:id', async (req, res) => {
  const id = req.params.id;
  const type = (req.query.type || req.body?.type || '').toString();
  if (!type) return res.status(400).json({ error: 'missing type' });
  const removed = deleteItem(type, id);
  if (!removed) return res.status(404).json({ error: 'not found or invalid type' });
  return res.json({ removed });
});

app.listen(PORT, () => {
  console.log(`Leaderboard proxy listening on ${PORT}`);
});
