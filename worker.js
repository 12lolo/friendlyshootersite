// Cloudflare Worker: serves the static site and a small KV-backed
// online leaderboard API for the World RPG at /api/rpg-leaderboard.
const LEADERBOARD_PATH = '/api/rpg-leaderboard';
const MAX_ENTRIES = 10;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === LEADERBOARD_PATH) {
      return handleLeaderboard(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleLeaderboard(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') === 'infinite' ? 'infinite' : 'story';
    return jsonResponse(await getTop(env, mode));
  }
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }
    const name = sanitizeName(body.name);
    const mode = body.mode === 'infinite' ? 'infinite' : 'story';
    const score = Math.max(0, Math.min(99999, Math.round(Number(body.score) || 0)));
    const label = sanitizeLabel(body.label);
    if (!name) return jsonResponse({ error: 'A player name is required' }, 400);

    const key = `rpg:${mode}:${name.toLowerCase()}`;
    const existingRaw = await env.RPG_LEADERBOARD.get(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    // Only keep a player's personal best per mode.
    if (!existing || score > existing.score) {
      await env.RPG_LEADERBOARD.put(key, JSON.stringify({ name, mode, score, label, stamp: Date.now() }));
    }
    return jsonResponse(await getTop(env, mode));
  }
  return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
}

function sanitizeName(name) {
  return String(name || '').trim().slice(0, 20).replace(/[^a-zA-Z0-9 _-]/g, '');
}

function sanitizeLabel(label) {
  return String(label || '').trim().slice(0, 60);
}

async function getTop(env, mode) {
  const prefix = `rpg:${mode}:`;
  const keys = [];
  let cursor;
  do {
    const page = await env.RPG_LEADERBOARD.list({ prefix, cursor });
    keys.push(...page.keys);
    cursor = page.cursor;
    if (page.list_complete) break;
  } while (cursor);

  const entries = await Promise.all(keys.map(async k => {
    const raw = await env.RPG_LEADERBOARD.get(k.name);
    return raw ? JSON.parse(raw) : null;
  }));

  return entries
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.stamp - b.stamp)
    .slice(0, MAX_ENTRIES);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}
