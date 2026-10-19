const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const { createAppServer } = require('../src/server');
async function start(t, options) {
  const server = createAppServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const message = { messages: [{ role: 'user', content: 'Ciao' }] };
const post = (url, body = message, headers = {}) => fetch(url + '/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
function upstream(status, payload) {
  return (options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = () => {};
    request.end = () => {
      const response = Readable.from([typeof payload === 'string' ? payload : JSON.stringify(payload)]);
      response.statusCode = status;
      callback(response);
    };
    return request;
  };
}
test('Tutte le pagine e gli asset pubblici sono serviti senza cache', async t => {
  const base = await start(t);
  const src = path.join(__dirname, '../src');
  for (const name of fs.readdirSync(src)) {
    if (['server.js', 'notifications.js', 'spaced-repetition.js'].includes(name)) continue;
    const response = await fetch(base + '/' + name);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    await response.arrayBuffer();
  }
  assert.equal((await fetch(base + '/?test=1')).status, 200);
  assert.equal((await fetch(base + '/inesistente.html')).status, 404);
});
test('File privati, traversal, origini esterne e metodi non supportati sono bloccati', async t => {
  const base = await start(t);
  for (const name of ['.env', 'server.js', 'notifications.js', '..%2fpackage.json']) {
    assert.equal((await fetch(base + '/' + name)).status, 403, name);
  }
  assert.equal((await fetch(base + '/%zz')).status, 400);
  assert.equal((await fetch(base, { method: 'DELETE' })).status, 405);
  assert.equal((await post(base, message, { Origin: 'https://esterno.example' })).status, 403);
});
test('AI senza chiave restituisce un errore esplicito', async t => {
  const base = await start(t);
  const response = await post(base);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /GROQ_API_KEY/);
});
test('JSON e messaggi invalidi non raggiungono il servizio AI', async t => {
  const base = await start(t, { apiKey: 'test', request: () => { throw Error('Non deve essere chiamato'); } });
  for (const body of ['{', null, {}, { messages: 'invalid' }, { messages: [null] }, { ...message, max_tokens: -1 }]) {
    const response = await post(base, body);
    assert.equal(response.status, 400);
  }
});
test('Risposta AI valida mantiene il formato atteso dalle sezioni', async t => {
  const base = await start(t, { apiKey: 'test', request: upstream(200, { choices: [{ message: { content: 'Ciao!' } }] }) });
  const response = await post(base);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content[0].text, 'Ciao!');
});
for (const [status, body, expected] of [[401, {}, 502], [429, {}, 429], [200, 'non-json', 502], [200, { choices: [] }, 502]]) {
  test(`Errore o risposta AI non valida: ${status}/${JSON.stringify(body)}`, async t => {
    const base = await start(t, { apiKey: 'test', request: upstream(status, body) });
    const response = await post(base);
    assert.equal(response.status, expected);
    assert.ok((await response.json()).error);
  });
}
test('Timeout AI restituisce 504 senza lasciare il client in attesa', async t => {
  const base = await start(t, { apiKey: 'test', request: () => {
    const request = new EventEmitter();
    request.setTimeout = (ms, callback) => { request.timeout = callback; };
    request.destroy = () => {};
    request.end = () => setImmediate(request.timeout);
    return request;
  } });
  assert.equal((await post(base)).status, 504);
});
