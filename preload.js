/**
 * preload.js — Context Bridge v2
 *
 * Espone al renderer:
 *   window.electronAPI  — API complete
 *   window.db           — shortcut DB
 *   window.sr           — Spaced Repetition (SM-2)
 *   window.backup       — Backup API
 *   window.notif        — Notifiche (trigger manuale)
 */

const { contextBridge, ipcRenderer } = require('electron');

const ipc = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

// ── DB API ────────────────────────────────────────────────────────────────────
const dbAPI = {
  studio: {
    getSessions:  (from, to) => ipc('db:studio:getSessions', from, to),
    addSession:   (s)        => ipc('db:studio:addSession', s),
    delSession:   (id)       => ipc('db:studio:delSession', id),
    getVoti:      ()         => ipc('db:studio:getVoti'),
    addVoto:      (v)        => ipc('db:studio:addVoto', v),
    getVerifiche: ()         => ipc('db:studio:getVerifiche'),
    addVerifica:  (v)        => ipc('db:studio:addVerifica', v),
    getNotes:     (subject)  => ipc('db:studio:getNotes', subject),
    saveNote:     (n)        => ipc('db:studio:saveNote', n),
    getStreak:    ()         => ipc('db:studio:getStreak'),
  },
  rpg: {
    getState:  ()  => ipc('db:rpg:getState'),
    saveState: (s) => ipc('db:rpg:saveState', s),
  },
  leo: {
    getCheckins:      (from, to) => ipc('db:leo:getCheckins', from, to),
    saveCheckin:      (c)        => ipc('db:leo:saveCheckin', c),
    getCheckin:       (date)     => ipc('db:leo:getCheckin', date),
    getPR:            ()         => ipc('db:leo:getPR'),
    savePR:           (pr)       => ipc('db:leo:savePR', pr),
    getMilestones:    ()         => ipc('db:leo:getMilestones'),
    saveMilestone:    (m)        => ipc('db:leo:saveMilestone', m),
    achieveMilestone: (id)       => ipc('db:leo:achieveMilestone', id),
    delMilestone:     (id)       => ipc('db:leo:delMilestone', id),
    getNotes:         ()         => ipc('db:leo:getNotes'),
    saveNote:         (n)        => ipc('db:leo:saveNote', n),
    delNote:          (id)       => ipc('db:leo:delNote', id),
    getSessions:      (from, to) => ipc('db:leo:getSessions', from, to),
    getSessionsByWeek:(week)     => ipc('db:leo:getSessionsByWeek', week),
    saveSession:      (s)        => ipc('db:leo:saveSession', s),
    delSession:       (id)       => ipc('db:leo:delSession', id),
    getWeekStats:     (week)     => ipc('db:leo:getWeekStats', week),
  },
  library: {
    getBooks: (status) => ipc('db:library:getBooks', status),
    saveBook: (b)      => ipc('db:library:saveBook', b),
    delBook:  (id)     => ipc('db:library:delBook', id),
  },
  agora: {
    getConversations: (charId) => ipc('db:agora:getConversations', charId),
    saveConversation: (c)      => ipc('db:agora:saveConversation', c),
    getMemory:        (id)     => ipc('db:agora:getMemory', id),
    saveMemory:       (id, m)  => ipc('db:agora:saveMemory', id, m),
    getCustomChars:   ()       => ipc('db:agora:getCustomChars'),
    saveCustomChar:   (c)      => ipc('db:agora:saveCustomChar', c),
  },
  flashcards: {
    getAll:   (subject) => ipc('db:fc:getAll', subject),
    save:     (card)    => ipc('db:fc:save', card),
    saveAll:  (cards)   => ipc('db:fc:saveAll', cards),
    del:      (id)      => ipc('db:fc:del', id),
    getDue:   ()        => ipc('db:fc:getDue'),
    getStats: ()        => ipc('db:fc:getStats'),
  },
  dailyMissions: {
    getByDate:  (date)      => ipc('db:dm:getByDate', date),
    getRange:   (from, to)  => ipc('db:dm:getRange', from, to),
    save:       (m)         => ipc('db:dm:save', m),
    complete:   (id)        => ipc('db:dm:complete', id),
    uncomplete: (id)        => ipc('db:dm:uncomplete', id),
    del:        (id)        => ipc('db:dm:del', id),
    getStats:   (date)      => ipc('db:dm:getStats', date),
  },
  analytics: {
    track:            (type, module, value, meta) => ipc('db:analytics:track', type, module, value, meta),
    getDayStats:      (date)        => ipc('db:analytics:getDayStats', date),
    getRange:         (from, to)    => ipc('db:analytics:getRange', from, to),
    getDailyTotals:   (from, to)    => ipc('db:analytics:getDailyTotals', from, to),
    getModuleRanking: (from, to)    => ipc('db:analytics:getModuleRanking', from, to),
    getCompletionRate:(date)        => ipc('db:analytics:getCompletionRate', date),
  },
  kv: {
    get: (key) => ipc('db:kv:get', key),
    set: (key, value) => ipc('db:kv:set', key, value),
    del: (key) => ipc('db:kv:del', key),
    has: (key) => ipc('db:kv:has', key),
  },
  settings: {
    get: (key) => ipc('db:settings:get', key),
    set: (key, value) => ipc('db:settings:set', key, value),
    getProfile: () => ipc('db:settings:getProfile'),
    saveProfile: (p) => ipc('db:settings:saveProfile', p),
  },
  profile: {
    get: () => ipc('db:profile:get'),
    save: (data) => ipc('db:profile:save', data),
  },
  orchestrator: {
    getPlan: (date) => ipc('db:orch:getPlan', date),
    savePlan: (date, plan) => ipc('db:orch:savePlan', date, plan),
    getAllPlans: () => ipc('db:orch:getAllPlans'),
    saveAllPlans: (plans) => ipc('db:orch:saveAllPlans', plans),
    getOverrides: () => ipc('db:orch:getOverrides'),
    saveOverrides: (o) => ipc('db:orch:saveOverrides', o),
    getMissions: (date) => ipc('db:orch:getMissions', date),
    saveMissions: (date, list) => ipc('db:orch:saveMissions', date, list),
  },
  recovery: {
    getAll: () => ipc('db:recovery:getAll'),
    upsert: (entry) => ipc('db:recovery:upsert', entry),
    resolve: (id) => ipc('db:recovery:resolve', id),
    delete: (id) => ipc('db:recovery:delete', id),
    saveAll: (entries) => ipc('db:recovery:saveAll', entries),
  },
  study: {
    getBlob: (key) => ipc('db:study:getBlob', key),
    setBlob: (key, data) => ipc('db:study:setBlob', key, data),
    getAllBlobs: () => ipc('db:study:getAllBlobs'),
    saveAllBlobs: (blobs) => ipc('db:study:saveAllBlobs', blobs),
  },
  gamification: {
    getState: () => ipc('db:gamification:getState'),
    saveState: (state) => ipc('db:gamification:saveState', state),
  },
  creativity: {
    getState: () => ipc('db:creativity:getState'),
    saveState: (state) => ipc('db:creativity:saveState', state),
  },
  engineer: {
    getState: () => ipc('db:engineer:getState'),
    getKey: (key) => ipc('db:engineer:getKey', key),
    setKey: (key, data) => ipc('db:engineer:setKey', key, data),
  },
  libraryState: {
    get: () => ipc('db:libraryState:get'),
    save: (state) => ipc('db:libraryState:save', state),
  },
  commandCenter: {
    getState: () => ipc('db:commandCenter:getState'),
    saveState: (state) => ipc('db:commandCenter:saveState', state),
  },
  coach: {
    log: (module, meta) => ipc('db:coach:log', module, meta),
    getLog: (limit) => ipc('db:coach:getLog', limit),
    getAnalytics: () => ipc('db:coach:getAnalytics'),
  },
  weeklyReview: {
    getAll: () => ipc('db:weeklyReview:getAll'),
    save: (review) => ipc('db:weeklyReview:save', review),
  },
  hub: {
    get: (key) => ipc('db:hub:get', key),
    set: (key, value) => ipc('db:hub:set', key, value),
  },
  migrations: {
    isDone: (name) => ipc('db:migrations:isDone', name),
    markDone: (name) => ipc('db:migrations:markDone', name),
  },
};

// ── Spaced Repetition API ─────────────────────────────────────────────────────
const srAPI = {
  /** Calcola il prossimo stato SM-2 per una card. quality: 0-5 */
  reviewCard:     (card, quality) => ipc('sr:reviewCard', card, quality),
  /** Ritorna le card da rivedere oggi */
  getDueCards:    (cards)         => ipc('sr:getDueCards', cards),
  /** Statistiche SM-2 su un set di card */
  getStats:       (cards)         => ipc('sr:getStats', cards),
  /** Ordina le card per priorità di revisione */
  sortByPriority: (cards)         => ipc('sr:sortByPriority', cards),
};

// ── Backup API ────────────────────────────────────────────────────────────────
const backupAPI = {
  /** Esegui un backup adesso → { path, records } */
  run:  ()  => ipc('backup:run'),
  /** Lista backup disponibili → [{filename, path, date, size}] */
  list: ()  => ipc('backup:list'),
  /** Percorso cartella backup */
  dir:  ()  => ipc('backup:dir'),
};

// ── Notifiche API ─────────────────────────────────────────────────────────────
const notifAPI = {
  test:       ()  => ipc('notif:test'),
  briefing:   ()  => ipc('notif:briefing'),
  streak:     ()  => ipc('notif:streak'),
  preVerifica:()  => ipc('notif:preVerifica'),
};

// ── Onboarding API ────────────────────────────────────────────────────────────
const onboardingAPI = {
  /** Segna l'onboarding come completato in SQLite (meta key = 'onboarding_done') */
  complete: () => ipc('onboarding:complete'),
};

// ── Esponi tutto ──────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  migrate:      (payload) => ipc('migrate', payload),
  migrateCheck: ()        => ipc('migrate-check'),
  onboarding:   onboardingAPI,
  db:     dbAPI,
  sr:     srAPI,
  backup: backupAPI,
  notif:  notifAPI,
});

contextBridge.exposeInMainWorld('onboarding', onboardingAPI);

// Shortcut comodi
contextBridge.exposeInMainWorld('db',        dbAPI);
contextBridge.exposeInMainWorld('sr',        srAPI);
contextBridge.exposeInMainWorld('backup',    backupAPI);
contextBridge.exposeInMainWorld('notif',     notifAPI);
contextBridge.exposeInMainWorld('analytics', dbAPI.analytics);
