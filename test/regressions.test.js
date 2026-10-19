const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('Command Center salva e ricarica una giornata senza ricorsione', async () => {
  const source = read('daily-command-center.html');
  const persistence = source.slice(source.indexOf('async function loadCommandState()'), source.indexOf('// ── INIT'));
  const context = vm.createContext({ window: {}, localStorage: storage(), STORAGE_KEY: 'test', state: { '2026-10-19': { mission: 'Studiare' } } });
  vm.runInContext(persistence + '\npersistCommandState(); state = {};', context);
  assert.equal((await vm.runInContext('loadCommandState()', context))['2026-10-19'].mission, 'Studiare');
  context.localStorage.setItem = () => { throw new Error('Disco pieno'); };
  assert.throws(() => vm.runInContext('persistCommandState()', context), /Disco pieno/);
});
test('Engineer legge array sincroni e conserva le modifiche al riavvio', () => {
  const source = read('engineer.html');
  const keys = source.match(/const LSKEYS = \{[\s\S]*?\n\};/)[0];
  const adapter = source.match(/const S = \{[\s\S]*?\n\};/)[0];
  const localStorage = storage();
  const context = vm.createContext({ localStorage });
  vm.runInContext(keys + '\n' + adapter + "\nS.push('projects', {name:'Ponte'}); S.push('projects', {name:'Casa'});", context);
  assert.equal(vm.runInContext("S.get('projects').length", context), 2);
  vm.runInContext("const a=S.get('projects');a.splice(0,1);S.set('projects',a);", context);
  const reload = vm.createContext({ localStorage });
  vm.runInContext(keys + '\n' + adapter, reload);
  assert.equal(vm.runInContext("S.get('projects')[0].name", reload), 'Ponte');
});
test('Agora mentor chiama il normale invio una sola volta', async () => {
  const source = read('agora.html');
  const start = source.indexOf('const _origSend = sendMessage;');
  const wrapper = source.slice(start, source.indexOf('// Toast', start));
  let calls = 0;
  const input = { value: 'Come studio?', placeholder: '' };
  const context = vm.createContext({ window: { _mentorMode: true }, document: { getElementById: () => input }, sendMessage: async () => { calls++; } });
  vm.runInContext(wrapper, context);
  await vm.runInContext('sendMessage()', context);
  assert.equal(calls, 1);
  assert.match(input.value, /^\[PROBLEMA REALE/);
  assert.equal(context.window._mentorMode, false);
});
test('Preload espone solo funzionalità reali e non il database o backup fittizi', () => {
  const exposed = {};
  const context = vm.createContext({ process: { platform: 'win32' }, require: () => ({
    contextBridge: { exposeInMainWorld: (name, value) => { exposed[name] = value; } },
    ipcRenderer: { invoke: async () => true },
  }) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), context);
  assert.equal(exposed.db, undefined);
  assert.equal(exposed.backup, undefined);
  assert.equal(exposed.analytics, undefined);
  assert.equal(exposed.electronAPI.capabilities.database, false);
  assert.equal(typeof exposed.sr.reviewCard, 'function');
});
test('Onboarding salva il primo libro nel formato Library senza duplicarlo', async () => {
  const source = read('onboarding.html');
  const code = source.slice(source.indexOf('async function completeOnboarding()'), source.indexOf('// Auto-focus'));
  const localStorage = storage();
  let navigations = 0;
  const context = vm.createContext({ localStorage, state: { name: 'Test', goal: 'studio', materie: [], book: 'Un libro' },
    window: { location: { replace: () => { navigations++; } } }, alert: msg => { throw new Error(msg); } });
  vm.runInContext(code, context);
  await vm.runInContext('completeOnboarding()', context);
  await vm.runInContext('completeOnboarding()', context);
  const library = JSON.parse(localStorage.getItem('leo_library_v1'));
  assert.equal(library.books.length, 1);
  assert.equal(library.books[0].title, 'Un libro');
  assert.equal(library.todayPages, 0);
  assert.equal(JSON.parse(localStorage.getItem('polylife_profile')).onboardingDone, true);
  assert.equal(navigations, 2);
});
test('Il service worker pulisce solo cache Polylife e non intercetta le richieste', async () => {
  const handlers = {};
  const deleted = [];
  const context = vm.createContext({ self: { addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { keys: async () => ['polymath-os-v11', 'studio-polymath-v4', 'altra-app'], delete: async key => { deleted.push(key); } } });
  vm.runInContext(read('service-worker.js'), context);
  let done;
  handlers.activate({ waitUntil: promise => { done = promise; } });
  await done;
  assert.deepEqual(deleted, ['polymath-os-v11', 'studio-polymath-v4']);
  assert.equal(handlers.fetch, undefined);
});
