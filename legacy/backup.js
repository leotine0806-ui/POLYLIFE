/**
 * Polylife — Backup Automatico Settimanale (P1)
 *
 * Ogni domenica alle 23:00 esporta tutti i dati SQLite in:
 *   ~/Documents/Polylife Backup/backup-YYYY-MM-DD.json
 *
 * Mantiene le ultime 8 settimane (8 file), elimina i più vecchi.
 *
 * Uso:
 *   const { backupData } = require('./src/backup');
 *   await backupData(getDB);  // getDB = funzione che ritorna il modulo db
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const MAX_BACKUPS = 8;

function getBackupDir() {
  const docs = path.join(os.homedir(), 'Documents', 'Polylife Backup');
  if (!fs.existsSync(docs)) fs.mkdirSync(docs, { recursive: true });
  return docs;
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

async function backupData(dbGetterFn) {
  const db = dbGetterFn ? dbGetterFn() : null;
  if (!db) throw new Error('Database non disponibile');

  const today = getDateStr();
  const backupDir = getBackupDir();
  const filePath = path.join(backupDir, `backup-${today}.json`);

  // ── Raccolta dati da tutti i moduli ──────────────────────────────────────
  const schemaRow = db.db().prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get();
  const payload = {
    version: 3,
    schemaVersion: schemaRow?.value || '2',
    date: new Date().toISOString(),
    studio: {
      sessions:  db.studio.getSessions('2000-01-01', '2099-12-31'),
      voti:      db.studio.getVoti(),
      verifiche: db.studio.getVerifiche(),
      notes:     db.studio.getNotes(),
      streak:    db.studio.getStreak(),
      blobs:     db.study?.getAllBlobs ? db.study.getAllBlobs() : {},
    },
    rpg:     db.rpg.getState(),
    leo: {
      checkins:   db.leo.getCheckins('2000-01-01', '2099-12-31'),
      pr:         db.leo.getPR(),
      milestones: db.leo.getMilestones(),
      sessions:   db.leo.getSessions('2000-01-01', '2099-12-31'),
    },
    library: {
      books: db.library.getBooks(),
      state: db.libraryState?.get ? db.libraryState.get() : null,
    },
    agora: {
      conversations:    db.agora.getConversations(),
      customCharacters: db.agora.getCustomChars()
    },
    flashcards: db.flashcards?.getAll ? db.flashcards.getAll() : [],
    dailyMissions: db.dailyMissions?.getRange ? db.dailyMissions.getRange('2000-01-01', '2099-12-31') : [],
    recovery: db.recovery?.getAll ? db.recovery.getAll() : [],
    orchestrator: {
      plans: db.orchestrator?.getAllPlans ? db.orchestrator.getAllPlans() : {},
      overrides: db.orchestrator?.getOverrides ? db.orchestrator.getOverrides() : {},
    },
    operatingProfile: db.profile?.get ? db.profile.get() : null,
    gamification: db.gamification?.getState ? db.gamification.getState() : null,
    creativity: db.creativity?.getState ? db.creativity.getState() : null,
    engineer: db.engineer?.getState ? db.engineer.getState() : null,
    commandCenter: db.commandCenter?.getState ? db.commandCenter.getState() : null,
    coach: db.coach?.getAnalytics ? db.coach.getAnalytics() : [],
    weeklyReviews: db.weeklyReview?.getAll ? db.weeklyReview.getAll() : [],
    settings: {
      profile: db.settings?.getProfile ? db.settings.getProfile() : null,
    },
    analytics: db.db().prepare(`SELECT * FROM analytics_events ORDER BY ts DESC LIMIT 5000`).all(),
    legacyLocalStorageNote: 'Restore via migration.html or PolySQLite helpers if legacy keys still in browser',
  };

  // Copia DB SQLite completo
  try {
    const dbPath = db.db().name;
    const dbCopyPath = filePath.replace('.json', '.db');
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, dbCopyPath);
    payload.sqliteBackupPath = dbCopyPath;
  } catch (_) {}

  // ── Scrivi JSON ───────────────────────────────────────────────────────────
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`  ✓ Backup salvato: ${filePath}`);

  // ── Mantieni solo gli ultimi MAX_BACKUPS file ─────────────────────────────
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(path.join(backupDir, f));
        console.log(`  🗑 Backup vecchio rimosso: ${f}`);
      } catch (_) {}
    }
  }

  return { path: filePath, records: Object.keys(payload).length };
}

/**
 * Ripristina un backup da file JSON.
 * Restituisce l'oggetto payload per eventuale utilizzo.
 */
function loadBackup(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Lista i backup disponibili, dal più recente al più vecchio.
 */
function listBackups() {
  try {
    const dir = getBackupDir();
    return fs.readdirSync(dir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => ({
        filename: f,
        path: path.join(dir, f),
        date: f.replace('backup-', '').replace('.json', ''),
        size: fs.statSync(path.join(dir, f)).size
      }));
  } catch (_) {
    return [];
  }
}

/**
 * Ripristina dati da payload backup (v3) nel database SQLite.
 */
function restoreFromPayload(dbGetterFn, payload) {
  const db = dbGetterFn ? dbGetterFn() : null;
  if (!db || !payload) throw new Error('Database o payload mancante');
  let records = 0;

  if (payload.studio?.blobs && db.study?.saveAllBlobs) {
    records += db.study.saveAllBlobs(payload.studio.blobs);
  }
  if (payload.rpg && db.rpg?.saveState) { db.rpg.saveState(payload.rpg); records++; }
  if (payload.library?.state && db.libraryState?.save) { db.libraryState.save(payload.library.state); records++; }
  if (payload.library?.books) {
    for (const b of payload.library.books) { db.library.saveBook(b); records++; }
  }
  if (payload.flashcards?.length && db.flashcards?.saveAll) {
    records += db.flashcards.saveAll(payload.flashcards);
  }
  if (payload.dailyMissions?.length) {
    for (const m of payload.dailyMissions) { db.dailyMissions.save(m); records++; }
  }
  if (payload.recovery?.length && db.recovery?.saveAll) {
    records += db.recovery.saveAll(payload.recovery);
  }
  if (payload.orchestrator?.plans && db.orchestrator?.saveAllPlans) {
    records += db.orchestrator.saveAllPlans(payload.orchestrator.plans);
  }
  if (payload.orchestrator?.overrides && db.orchestrator?.saveOverrides) {
    db.orchestrator.saveOverrides(payload.orchestrator.overrides); records++;
  }
  if (payload.operatingProfile && db.profile?.save) { db.profile.save(payload.operatingProfile); records++; }
  if (payload.gamification && db.gamification?.saveState) { db.gamification.saveState(payload.gamification); records++; }
  if (payload.creativity && db.creativity?.saveState) { db.creativity.saveState(payload.creativity); records++; }
  if (payload.engineer && db.engineer) {
    for (const [k, v] of Object.entries(payload.engineer)) { db.engineer.setKey(k, v); records++; }
  }
  if (payload.commandCenter && db.commandCenter?.saveState) { db.commandCenter.saveState(payload.commandCenter); records++; }
  if (payload.settings?.profile && db.settings?.saveProfile) { db.settings.saveProfile(payload.settings.profile); records++; }
  if (payload.weeklyReviews?.length) {
    for (const r of payload.weeklyReviews) { db.weeklyReview.save(r); records++; }
  }

  return { success: true, records };
}

module.exports = { backupData, loadBackup, listBackups, getBackupDir, restoreFromPayload };
