const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Carica variabili d'ambiente da .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT  = parseInt(process.env.PORT || '2008', 10);
const DIR   = __dirname;
const INDEX = 'polymath_os_v9.html';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL   = process.env.GROQ_MODEL   || 'llama-3.3-70b-versatile';

if (!GROQ_API_KEY || GROQ_API_KEY === 'gsk_LA_TUA_CHIAVE_QUI') {
  console.warn('\n  ⚠  GROQ_API_KEY mancante. Le funzionalità AI non funzioneranno.');
  console.warn('  Crea il file .env nella root del progetto.\n');
}

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.css':  'text/css',
};

http.createServer((req, res) => {

  // ── Proxy AI → Groq ───────────────────────────
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) {
        res.writeHead(400); res.end('Bad JSON'); return;
      }

      // Converti formato {system, messages} → OpenAI-style Groq
      const messages = [];
      if (parsed.system) messages.push({ role: 'system', content: parsed.system });
      (parsed.messages || []).forEach(m => messages.push({ role: m.role, content: m.content }));

      const groqBody = JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: parsed.max_tokens || 4096,
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
          if (proxyRes.statusCode !== 200) {
            console.log('\n  ❌ Groq error', proxyRes.statusCode + ':', data, '\n');
          }
          // Converti risposta Groq → formato Anthropic-style {content:[{text}]}
          let out;
          try {
            const groqData = JSON.parse(data);
            const text = groqData.choices?.[0]?.message?.content || '';
            out = JSON.stringify({ content: [{ text }] });
          } catch(e) {
            out = JSON.stringify({ content: [{ text: '' }] });
          }
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(out);
        });
      });

      proxyReq.on('error', err => {
        console.log('\n  ❌ Errore proxy:', err.message, '\n');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ text: '' }] }));
      });

      proxyReq.write(groqBody);
      proxyReq.end();
    });
    return;
  }

  // ── CORS preflight ────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ── File server ───────────────────────────────
  let urlPath = req.url === '/' ? '/' + INDEX : req.url.split('?')[0];
  const filePath = path.join(DIR, urlPath);
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  const mime = MIME[path.extname(filePath)] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + req.url); return; }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log('');
  console.log('  POLYMATH OS v2 — Server attivo!');
  console.log('  ─────────────────────────────────────────');
  console.log('  Polymath OS   ->  http://localhost:' + PORT);
  console.log('  Studio        ->  http://localhost:' + PORT + '/studio_polymath_v4.html');
  console.log('  Agora Classic ->  http://localhost:' + PORT + '/agora.html');
  console.log('  Agora Anime   ->  http://localhost:' + PORT + '/agora_anime.html');
  console.log('  Engineer      ->  http://localhost:' + PORT + '/engineer.html');
  console.log('  Library       ->  http://localhost:' + PORT + '/library_fixed.html');
  console.log('  Life RPG      ->  http://localhost:' + PORT + '/life_rpg_v2.html');
  console.log('  LEO Protocol  ->  http://localhost:' + PORT + '/leo_protocol_v8.html');
  console.log('  Flashcard SM2 ->  http://localhost:' + PORT + '/flashcards.html');
  console.log('  Missioni RPG  ->  http://localhost:' + PORT + '/daily-missions.html');
  console.log('  Hub Calendario->  http://localhost:' + PORT + '/hub-calendar.html');
  console.log('  Planner Studio->  http://localhost:' + PORT + '/studio-planner.html');
  console.log('  Impostazioni  ->  http://localhost:' + PORT + '/settings.html');
  console.log('  ─────────────────────────────────────────');
  console.log('  AI: Groq (llama-3.3-70b) — proxy attivo');
  console.log('  (tieni questa finestra aperta)');
  console.log('');
});
