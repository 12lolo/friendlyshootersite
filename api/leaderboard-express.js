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

app.listen(PORT, () => {
  console.log(`Leaderboard proxy listening on ${PORT}`);
});
