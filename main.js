const { app, BrowserWindow, shell, ipcMain, Notification } = require('electron');
const path = require('path');
const http  = require('http');
const https = require('https');
const fs    = require('fs');

const dotenv = require('dotenv');
const _devEnv  = path.join(__dirname, '.env');
const _prodEnv = path.join(process.env.APPDATA || '', 'polylife', '.env');
if (fs.existsSync(_devEnv)) {
  dotenv.config({ path: _devEnv });
} else if (fs.existsSync(_prodEnv)) {
  dotenv.config({ path: _prodEnv });
}

const PORT  = parseInt(process.env.PORT || '2008', 10);
const DIR   = path.join(__dirname, 'src');
const INDEX = 'polymath_os_v9.html';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL   = process.env.GROQ_MODEL   || 'llama-3.3-70b-versatile';

if (!GROQ_API_KEY || GROQ_API_KEY === 'gsk_LA_TUA_CHIAVE_QUI') {
  console.warn('\n  ⚠  GROQ_API_KEY mancante o non configurata.');
  console.warn('  Crea il file .env copiando .env.example e inserisci la tua chiave.');
  console.warn('  Le funzionalità AI non funzioneranno.\n');
}

console.log('  ℹ Database: localStorage (modalità standard)');

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.css':  'text/css',
};

// ── Stato app su file JSON (sostituisce tabella meta SQLite) ──────────────────
function getStatePath() {
  try {
    return path.join(app.getPath('userData'), 'polylife_state.json');
  } catch (_) {
    return path.join(process.env.APPDATA || __dirname, 'Polylife', 'polylife_state.json');
  }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(getStatePath(), 'utf8')); } catch (_) { return {}; }
}

function writeState(patch) {
  try {
    const next = { ...readState(), ...patch };
    fs.mkdirSync(path.dirname(getStatePath()), { recursive: true });
    fs.writeFileSync(getStatePath(), JSON.stringify(next, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[State] Write failed:', e.message);
    return false;
  }
}

// ── IPC handlers ───────────────────────────────────────────────────────────────
function registerIPC() {

  ipcMain.handle('onboarding:complete', () => {
    const ok = writeState({ onboarding_done: 'true' });
    console.log('[onboarding:complete] Written:', ok);
    return { success: ok };
  });

  ipcMain.handle('migrate-check', () => ({ needed: false, reason: 'localStorage-mode' }));
  ipcMain.handle('migrate', async () => ({ success: true, records: 0 }));

  // Tutti i db:* handler sono no-op: il renderer usa localStorage come storage primario
  const noop    = () => null;
  const noopArr = () => [];
  const noopObj = () => ({});
  const noopN   = () => 0;
  const noopF   = () => false;

  const handlers = [
    ['db:studio:getSessions', noopArr], ['db:studio:addSession', noop], ['db:studio:delSession', noop],
    ['db:studio:getVoti', noopArr],     ['db:studio:addVoto', noop],
    ['db:studio:getVerifiche', noopArr],['db:studio:addVerifica', noop],
    ['db:studio:getNotes', noopArr],    ['db:studio:saveNote', noop],   ['db:studio:getStreak', noopArr],

    ['db:rpg:getState', noop], ['db:rpg:saveState', noop],

    ['db:leo:getCheckins', noopArr],    ['db:leo:saveCheckin', noop],   ['db:leo:getCheckin', noop],
    ['db:leo:getPR', noopArr],          ['db:leo:savePR', noop],
    ['db:leo:getMilestones', noopArr],  ['db:leo:saveMilestone', noop],
    ['db:leo:achieveMilestone', noop],  ['db:leo:delMilestone', noop],
    ['db:leo:getNotes', noopArr],       ['db:leo:saveNote', noop],      ['db:leo:delNote', noop],
    ['db:leo:getSessions', noopArr],    ['db:leo:getSessionsByWeek', noopArr],
    ['db:leo:saveSession', noop],       ['db:leo:delSession', noop],    ['db:leo:getWeekStats', noopObj],

    ['db:library:getBooks', noopArr],   ['db:library:saveBook', noop],  ['db:library:delBook', noop],

    ['db:agora:getConversations', noopArr], ['db:agora:saveConversation', noop],
    ['db:agora:getMemory', noop],           ['db:agora:saveMemory', noop],
    ['db:agora:getCustomChars', noopArr],   ['db:agora:saveCustomChar', noop],

    ['db:dm:getByDate', noopArr],  ['db:dm:getRange', noopArr], ['db:dm:save', noop],
    ['db:dm:complete', noop],      ['db:dm:uncomplete', noop],  ['db:dm:del', noop],
    ['db:dm:getStats', noopObj],

    ['db:analytics:track', noop],            ['db:analytics:getDayStats', noop],
    ['db:analytics:getRange', noopArr],      ['db:analytics:getDailyTotals', noopArr],
    ['db:analytics:getModuleRanking', noopArr],['db:analytics:getCompletionRate', noop],

    ['db:fc:getAll', noopArr], ['db:fc:save', noop],    ['db:fc:del', noop],
    ['db:fc:getDue', noopArr], ['db:fc:getStats', noopObj], ['db:fc:saveAll', noopN],

    ['db:kv:get', noop], ['db:kv:set', noop], ['db:kv:del', noop], ['db:kv:has', noopF],

    ['db:settings:get', noop], ['db:settings:set', noop],
    ['db:settings:getProfile', noop], ['db:settings:saveProfile', noop],

    ['db:profile:get', noop], ['db:profile:save', noop],

    ['db:orch:getPlan', noop],        ['db:orch:savePlan', noop],
    ['db:orch:getAllPlans', noopObj],  ['db:orch:saveAllPlans', noopN],
    ['db:orch:getOverrides', noopObj],['db:orch:saveOverrides', noop],
    ['db:orch:getMissions', noopArr], ['db:orch:saveMissions', noopN],

    ['db:recovery:getAll', noopArr], ['db:recovery:upsert', noop],
    ['db:recovery:resolve', noop],   ['db:recovery:delete', noop], ['db:recovery:saveAll', noopN],

    ['db:study:getBlob', noop],      ['db:study:setBlob', noop],
    ['db:study:getAllBlobs', noopObj],['db:study:saveAllBlobs', noopN],

    ['db:gamification:getState', noop],  ['db:gamification:saveState', noop],
    ['db:creativity:getState', noop],    ['db:creativity:saveState', noop],
    ['db:engineer:getState', noopObj],   ['db:engineer:getKey', noop],  ['db:engineer:setKey', noop],
    ['db:libraryState:get', noop],       ['db:libraryState:save', noop],
    ['db:commandCenter:getState', noop], ['db:commandCenter:saveState', noop],

    ['db:coach:log', noop],          ['db:coach:getLog', noopArr],  ['db:coach:getAnalytics', noopArr],
    ['db:weeklyReview:getAll', noopArr], ['db:weeklyReview:save', noop],
    ['db:hub:get', noop],            ['db:hub:set', noop],
    ['db:migrations:isDone', noopF], ['db:migrations:markDone', noop],
  ];

  for (const [channel, fn] of handlers) {
    ipcMain.handle(channel, fn);
  }

  // ── Spaced Repetition ──────────────────────────────────────────────────────
  ipcMain.handle('sr:reviewCard',     (_, card, quality) => require('./src/spaced-repetition').reviewCard(card, quality));
  ipcMain.handle('sr:getDueCards',    (_, cards)         => require('./src/spaced-repetition').getDueCards(cards));
  ipcMain.handle('sr:getStats',       (_, cards)         => require('./src/spaced-repetition').getStats(cards));
  ipcMain.handle('sr:sortByPriority', (_, cards)         => require('./src/spaced-repetition').sortByPriority(cards));

  // ── Backup (no-op) ─────────────────────────────────────────────────────────
  ipcMain.handle('backup:run',  async () => ({ success: true, records: 0, note: 'localStorage mode' }));
  ipcMain.handle('backup:list', () => []);
  ipcMain.handle('backup:dir',  () => '');

  // ── Notifiche ──────────────────────────────────────────────────────────────
  ipcMain.handle('notif:test', () => {
    if (Notification.isSupported()) {
      new Notification({ title: '🔔 Test Polylife', body: 'Le notifiche funzionano!' }).show();
      return true;
    }
    return false;
  });
  ipcMain.handle('notif:briefing',    async () => { try { await require('./src/notifications').briefingMattutino();  } catch(_){} return true; });
  ipcMain.handle('notif:streak',      async () => { try { await require('./src/notifications').streakCheckSerale();  } catch(_){} return true; });
  ipcMain.handle('notif:preVerifica', async () => { try { await require('./src/notifications').alertPreVerifica();   } catch(_){} return true; });
}

// ── Server interno ─────────────────────────────────────────────────────────────
function startServer() {
  const server = http.createServer((req, res) => {

    if (req.method === 'POST' && req.url === '/api/chat') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }

        const messages = [];
        if (parsed.system) messages.push({ role: 'system', content: parsed.system });
        (parsed.messages || []).forEach(m => messages.push({ role: m.role, content: m.content }));

        const groqBody = JSON.stringify({
          model: GROQ_MODEL, messages,
          max_tokens: parsed.max_tokens || 1000,
          temperature: 0.85
        });

        const options = {
          hostname: 'api.groq.com',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Length': Buffer.byteLength(groqBody)
          }
        };

        const proxyReq = https.request(options, proxyRes => {
          let data = '';
          proxyRes.on('data', chunk => data += chunk);
          proxyRes.on('end', () => {
            let out;
            try {
              const groqData = JSON.parse(data);
              const text = groqData.choices?.[0]?.message?.content || '';
              out = JSON.stringify({ content: [{ text }] });
            } catch(e) { out = JSON.stringify({ content: [{ text: '' }] }); }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(out);
          });
        });
        proxyReq.on('error', () => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content: [{ text: '' }] }));
        });
        proxyReq.write(groqBody);
        proxyReq.end();
      });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    let urlPath = req.url === '/' ? '/' + INDEX : req.url.split('?')[0];
    const filePath = path.join(DIR, urlPath);
    const normalFilePath = path.normalize(filePath);
    const normalDIR = path.normalize(DIR);
    if (!normalFilePath.startsWith(normalDIR)) { res.writeHead(403); res.end('Forbidden'); return; }
    const mime = MIME[path.extname(normalFilePath)] || 'text/plain';
    fs.readFile(normalFilePath, (err, data) => {
      if (err) { console.error('[404]', urlPath); res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });

  server.listen(PORT);
  return server;
}

// ── Finestra Electron ──────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'Polylife',
    icon: path.join(DIR, 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#0a0a0f',
    show: false
  });

  win.once('ready-to-show', () => win.show());


  win.loadURL(`http://localhost:${PORT}`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://localhost:${PORT}`)) { win.loadURL(url); return { action: 'deny' }; }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.setMenuBarVisibility(false);
}

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  registerIPC();
  const server = startServer();

  try {
    const notifications = require('./src/notifications');
    notifications.start(() => null);
    console.log('  ✓ Notifiche pianificate (07:00 briefing, 19:00 pre-verifica, 20:00 streak, dom 23:00 backup)');
  } catch (e) {
    console.warn('  ⚠ Notifiche non disponibili:', e.message);
  }

  server.once('listening', () => createWindow());
  if (server.listening) createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
