// ═══════════════════════════════════════════════════════════════
//  SYNTIQ TRADING — BACKEND SERVER
//  Node.js + Express  |  Deploy free on Render.com
//  All data stored in memory + persisted to data.json
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_KEY  = process.env.ADMIN_KEY || 'syntiq2025';

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname)); // serve the HTML file

// ── In-memory database ──────────────────────────────────────────
let DB = { apps:{}, users:{}, providers:{}, signals:{}, chats:{}, following:{}, pv_fees:{} };

// Load persisted data on startup
function loadData() {
  try {
    if(fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      DB = JSON.parse(raw);
      // Ensure all collections exist
      ['apps','users','providers','signals','chats','following','pv_fees'].forEach(c => {
        if(!DB[c]) DB[c] = {};
      });
      console.log('✅ Data loaded:', Object.keys(DB).map(k => `${k}:${Object.keys(DB[k]).length}`).join(', '));
    }
  } catch(e) {
    console.error('⚠ Could not load data.json:', e.message);
  }
}

// Save to disk (debounced)
let saveTimer = null;
function saveData() {
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2));
    } catch(e) {
      console.error('⚠ Could not save data.json:', e.message);
    }
  }, 500);
}

loadData();

// ── API Routes ──────────────────────────────────────────────────

// GET /api/ping — health check
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, status: 'Syntiq Trading backend running', collections: Object.keys(DB).map(k => ({ name: k, count: Object.keys(DB[k]).length })) });
});

// GET /api/:collection — get all records
app.get('/api/:col', (req, res) => {
  const col = req.params.col;
  if(!DB[col]) return res.status(404).json({ ok: false, error: `Unknown collection: ${col}` });
  const records = Object.values(DB[col]).sort((a,b) => (b._ts||0) - (a._ts||0));
  res.json({ ok: true, data: records, count: records.length });
});

// GET /api/:collection/:id — get one record
app.get('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if(!DB[col]) return res.status(404).json({ ok: false, error: `Unknown collection: ${col}` });
  const record = DB[col][id];
  if(!record) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, data: record });
});

// POST /api/:collection — create or update a record
app.post('/api/:col', (req, res) => {
  const col    = req.params.col;
  const record = req.body;
  if(!DB[col]) return res.status(404).json({ ok: false, error: `Unknown collection: ${col}` });
  if(!record.id) record.id = Date.now().toString();
  record._ts = Date.now();
  DB[col][record.id] = record;
  saveData();
  res.json({ ok: true, data: record });
});

// PATCH /api/:collection/:id — partial update
app.patch('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if(!DB[col]) return res.status(404).json({ ok: false, error: `Unknown collection: ${col}` });
  if(!DB[col][id]) return res.status(404).json({ ok: false, error: 'Not found' });
  DB[col][id] = { ...DB[col][id], ...req.body, id, _ts: Date.now() };
  saveData();
  res.json({ ok: true, data: DB[col][id] });
});

// DELETE /api/:collection/:id — delete one record
app.delete('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if(!DB[col] || !DB[col][id]) return res.status(404).json({ ok: false, error: 'Not found' });
  delete DB[col][id];
  saveData();
  res.json({ ok: true, deleted: true });
});

// DELETE /api/:collection — wipe entire collection (admin only)
app.delete('/api/:col', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.adminKey;
  if(key !== ADMIN_KEY) return res.status(403).json({ ok: false, error: 'Unauthorized' });
  const col = req.params.col;
  if(!DB[col]) return res.status(404).json({ ok: false, error: `Unknown collection: ${col}` });
  DB[col] = {};
  saveData();
  res.json({ ok: true, wiped: true });
});

// POST /api/admin/wipe-all — wipe everything (admin only)
app.post('/api/admin/wipe-all', (req, res) => {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  if(key !== ADMIN_KEY) return res.status(403).json({ ok: false, error: 'Unauthorized' });
  DB = { apps:{}, users:{}, providers:{}, signals:{}, chats:{}, following:{}, pv_fees:{} };
  saveData();
  res.json({ ok: true, message: 'All data wiped' });
});

// Serve the HTML app for any other route
app.get('*', (req, res) => {
  const htmlFile = path.join(__dirname, 'syntiq_trading.html');
  if(fs.existsSync(htmlFile)) {
    res.sendFile(htmlFile);
  } else {
    res.json({ ok: true, message: 'Syntiq Trading API server. Place syntiq_trading.html in this directory.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Syntiq Trading server running on port ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/ping`);
});
