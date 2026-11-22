import fs from 'fs';

const STATE_FILE = '/tmp/spystore_shared_state.json';

function readState() {
  if (!global.__SPYSTORE_SHARED_STATE) {
    try {
      if (fs.existsSync(STATE_FILE)) {
        global.__SPYSTORE_SHARED_STATE = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      }
    } catch (e) {}
  }
  if (!global.__SPYSTORE_SHARED_STATE || typeof global.__SPYSTORE_SHARED_STATE !== 'object') {
    global.__SPYSTORE_SHARED_STATE = {
      verifiedAdmins: [],
      catalog: null,
      templates: null,
      updatedAt: Date.now()
    };
  }
  return global.__SPYSTORE_SHARED_STATE;
}

function writeState(nextState) {
  global.__SPYSTORE_SHARED_STATE = nextState;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState), 'utf8');
  } catch (e) {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const state = readState();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, ...state });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (Array.isArray(body.verifiedAdmins)) {
      state.verifiedAdmins = Array.from(new Set(
        body.verifiedAdmins.map(x => String(x || '').trim().toLowerCase()).filter(Boolean)
      ));
    }
    if (body.catalog !== undefined) {
      state.catalog = body.catalog;
    }
    if (body.templates !== undefined) {
      state.templates = body.templates;
    }
    state.updatedAt = Date.now();
    writeState(state);
    return res.status(200).json({ ok: true, ...state });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
