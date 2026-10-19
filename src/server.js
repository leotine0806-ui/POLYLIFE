// One HTTP implementation shared by Electron and the browser preview.
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const fs = require('node:fs');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8' };
function createAppServer({ apiKey = '', model = 'llama-3.3-70b-versatile', staticDir = __dirname,
  request = https.request, timeoutMs = 30000 } = {}) {
  const json = (res, status, data) => {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const fail = (res, status, message) => json(res, status, { error: message, content: [{ text: '' }] });
  const root = path.resolve(staticDir);
  return http.createServer((req, res) => {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      fail(res, 403, 'Origine non autorizzata'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(req.url.split('?')[0]); }
    catch { fail(res, 400, 'Percorso non valido'); return; }
    if (pathname === '/api/chat' && req.method === 'POST') {
      if (!apiKey || apiKey === 'gsk_LA_TUA_CHIAVE_QUI') {
        fail(res, 503, 'Configura GROQ_API_KEY nel file .env per usare l’AI'); return;
      }
      const chunks = [];
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) { fail(res, 413, 'Richiesta troppo grande'); return; }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        let parsed;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { fail(res, 400, 'JSON non valido'); return; }
        const validMessage = m => m && ['user', 'assistant', 'system'].includes(m.role)
          && (typeof m.content === 'string' || Array.isArray(m.content));
        if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length
          || !parsed.messages.every(validMessage) || (parsed.system != null && typeof parsed.system !== 'string')
          || (parsed.max_tokens != null && (!Number.isInteger(parsed.max_tokens) || parsed.max_tokens < 1 || parsed.max_tokens > 32768))) {
          fail(res, 400, 'Messaggi o max_tokens non validi'); return;
        }
        const messages = parsed.system ? [{ role: 'system', content: parsed.system }, ...parsed.messages] : parsed.messages;
        const body = JSON.stringify({ model, messages, max_tokens: parsed.max_tokens || 4096, temperature: 0.85 });
        const upstream = request({ hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) } }, response => {
          let data = '';
          response.setEncoding('utf8');
          response.on('data', chunk => { data += chunk; });
          response.on('error', () => fail(res, 502, 'Risposta AI interrotta'));
          response.on('end', () => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
              fail(res, response.statusCode === 429 ? 429 : 502, `Servizio AI: errore ${response.statusCode}`); return;
            }
            try {
              const text = JSON.parse(data).choices?.[0]?.message?.content;
              if (typeof text !== 'string' || !text.trim()) throw new Error('Risposta vuota');
              json(res, 200, { content: [{ text }] });
            } catch { fail(res, 502, 'Il servizio AI ha restituito una risposta non valida'); }
          });
        });
        upstream.setTimeout(timeoutMs, () => {
          fail(res, 504, 'Tempo di attesa del servizio AI scaduto');
          upstream.destroy();
        });
        upstream.on('error', () => fail(res, 502, 'Servizio AI non raggiungibile'));
        upstream.end(body);
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { fail(res, 405, 'Metodo non consentito'); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/polymath_os_v9.html' : pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part.startsWith('.'))
      || ['server.js', 'notifications.js', 'spaced-repetition.js'].includes(relative)) {
      fail(res, 403, 'Percorso non consentito'); return;
    }
    fs.readFile(file, (error, data) => {
      if (error) { fail(res, 404, 'File non trovato'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}
if (require.main === module) {
  try {
    const config = require('../config').loadConfig();
    const server = createAppServer(config);
    server.on('error', error => { console.error('Avvio non riuscito:', error.message); process.exitCode = 1; });
    server.listen(config.port, '127.0.0.1', () => console.log(`Polylife: http://localhost:${config.port} — anteprima browser, dati separati dall’app desktop`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { createAppServer };
