// ═══════════════════════════════════════════════════════════════
//  SYNTIQ TRADING — BACKEND SERVER
//  Node.js + Express  |  Deploy free on Render.com
//
//  HOW TO DEPLOY:
//  1. Upload server.js, package.json, syntiq_trading.html to GitHub
//  2. Connect repo to render.com → New Web Service
//  3. Build: npm install  |  Start: node server.js
//  4. Your URL (e.g. https://syntiq-backend.onrender.com) IS the platform
//     Share that URL with all your users — done!
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ── In-memory database ──────────────────────────────────────────
const COLLECTIONS = ['apps','users','providers','signals','chats','following','pv_fees'];
let DB = {};
COLLECTIONS.forEach(c => DB[c] = {});

function loadData() {
  try {
    if(fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const saved = JSON.parse(raw);
      COLLECTIONS.forEach(c => { DB[c] = saved[c] || {}; });
      const summary = COLLECTIONS.map(c => `${c}:${Object.keys(DB[c]).length}`).join(' | ');
      console.log('✅ Data loaded:', summary);
    } else {
      console.log('📦 No data.json yet — starting fresh');
    }
  } catch(e) {
    console.error('⚠ Load error:', e.message);
  }
}

let saveTimer = null;
function saveData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(DB, null, 2), err => {
      if(err) console.error('⚠ Save error:', err.message);
    });
  }, 300);
}

loadData();

// ── API ─────────────────────────────────────────────────────────

app.get('/api/ping', (req, res) => {
  const stats = {};
  COLLECTIONS.forEach(c => stats[c] = Object.keys(DB[c]).length);
  res.json({ ok: true, status: 'Syntiq Trading backend running', stats });
});

// Get all records from a collection
app.get('/api/:col', (req, res) => {
  const col = req.params.col;
  if(!DB[col]) return res.status(404).json({ ok: false, error: 'Unknown collection: ' + col });
  const data = Object.values(DB[col]).sort((a,b) => (b._ts||0)-(a._ts||0));
  res.json({ ok: true, data, count: data.length });
});

// Create or update a record
app.post('/api/:col', (req, res) => {
  const col = req.params.col;
  if(!DB[col]) return res.status(404).json({ ok: false, error: 'Unknown collection: ' + col });
  const record = req.body;
  if(!record.id) record.id = Date.now().toString();
  record._ts = Date.now();
  DB[col][record.id] = record;
  saveData();
  res.json({ ok: true, data: record });
});

// Partial update
app.patch('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if(!DB[col]) return res.status(404).json({ ok: false, error: 'Unknown collection' });
  DB[col][id] = { ...(DB[col][id]||{}), ...req.body, id, _ts: Date.now() };
  saveData();
  res.json({ ok: true, data: DB[col][id] });
});

// Delete one record
app.delete('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if(DB[col] && DB[col][id]) { delete DB[col][id]; saveData(); }
  res.json({ ok: true, deleted: true });
});

// Wipe entire collection (admin only)
app.delete('/api/:col', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.adminKey;
  if(key !== 'syntiq2025') return res.status(403).json({ ok: false, error: 'Unauthorized' });
  const col = req.params.col;
  if(DB[col]) { DB[col] = {}; saveData(); }
  res.json({ ok: true, wiped: true });
});

// Wipe all (admin only)
app.post('/api/admin/wipe-all', (req, res) => {
  const key = req.headers['x-admin-key'] || (req.body && req.body.adminKey);
  if(key !== 'syntiq2025') return res.status(403).json({ ok: false, error: 'Unauthorized' });
  COLLECTIONS.forEach(c => DB[c] = {});
  saveData();
  res.json({ ok: true, message: 'All data wiped' });
});

// ── Serve the HTML platform ────────────────────────────────────
// The HTML file is served at / so users just visit your Render URL
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'syntiq_trading.html');
  if(fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.send('<h2>Syntiq Trading</h2><p>Place syntiq_trading.html in the same folder as server.js</p><p><a href="/api/ping">API status</a></p>');
  }
});

// Catch-all: serve HTML for any non-API route
app.get(/^(?!\/api).*/, (req, res) => {
  const htmlPath = path.join(__dirname, 'syntiq_trading.html');
  if(fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  SYNTIQ TRADING — Server running          ║');
  console.log(`║  http://localhost:${PORT}                     ║`);
  console.log('║  /api/ping  to verify API is working      ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
});
