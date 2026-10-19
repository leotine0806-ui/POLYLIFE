/**
 * Polylife — Notifiche Locali (P1)
 *
 * Usa node-schedule + Electron Notification API.
 * Pianifica:
 *   - 07:00 ogni giorno → Briefing mattutino
 *   - 20:00 ogni giorno → Streak check serale
 *   - Alert pre-verifica → giorno prima della verifica
 *
 * Uso in main.js:
 *   const notifications = require('./src/notifications');
 *   notifications.start(getDB);
 */

const schedule = require('node-schedule');
const { Notification, app } = require('electron');
const path = require('path');

let dbGetter = null;

// ── helpers ──────────────────────────────────────────────────────────────────

function notify(title, body, urgent = false) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'icon-512.png'),
    urgency: urgent ? 'critical' : 'normal',
    timeoutType: 'default'
  });
  n.show();
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── logica briefing 07:00 ────────────────────────────────────────────────────

async function briefingMattutino() {
  const db = dbGetter ? dbGetter() : null;
  if (!db) {
    notify('🌅 Buongiorno!', 'Apri Polylife per controllare la tua giornata.');
    return;
  }

  try {
    // Verifiche di oggi
    const verifiche = db.studio.getVerifiche().filter(v => v.date === getToday());
    // Streak corrente
    const streak = db.studio.getStreak();
    const streakCount = streak.length > 0 ? calcolaStreak(streak) : 0;
    // Checkin LEO di ieri
    const ieri = new Date(); ieri.setDate(ieri.getDate() - 1);
    const ieriFmt = ieri.toISOString().slice(0, 10);
    const checkinIeri = db.leo.getCheckin(ieriFmt);

    let body = '';
    if (streakCount > 0) body += `🔥 Streak: ${streakCount} giorni. `;
    if (verifiche.length > 0) body += `⚠️ ${verifiche.length} verifica/e oggi! `;
    if (!checkinIeri) body += `📋 Check-in ieri mancante. `;
    if (!body) body = 'Nessun impegno urgente oggi. Buona giornata!';

    notify('🌅 Briefing Polylife', body.trim());
  } catch (e) {
    notify('🌅 Buongiorno!', 'Apri Polylife per controllare la tua giornata.');
  }
}

function calcolaStreak(streakRows) {
  // streakRows = [{date: 'YYYY-MM-DD'}, ...]
  const dates = streakRows.map(r => r.date).sort().reverse();
  if (!dates.length) return 0;
  let count = 0;
  let expected = getToday();
  for (const d of dates) {
    if (d === expected) {
      count++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().slice(0, 10);
    } else break;
  }
  return count;
}

// ── logica streak check 20:00 ────────────────────────────────────────────────

async function streakCheckSerale() {
  const db = dbGetter ? dbGetter() : null;
  if (!db) {
    notify('🌙 Check serale', 'Hai registrato la tua sessione di oggi?');
    return;
  }

  try {
    const today = getToday();
    const sessions = db.studio.getSessions(today, today);
    const checkin = db.leo.getCheckin(today);

    if (sessions.length === 0 && !checkin) {
      notify(
        '⚠️ Streak a rischio!',
        'Nessuna sessione Studio né check-in LEO oggi. Aggiorna Polylife prima di mezzanotte!',
        true
      );
    } else if (sessions.length === 0) {
      notify('📚 Sessione mancante', 'Non hai registrato sessioni di studio oggi.');
    } else if (!checkin) {
      notify('🏋️ Check-in mancante', 'Ricorda di fare il check-in LEO di oggi!');
    } else {
      const streak = db.studio.getStreak();
      const count = calcolaStreak(streak);
      notify('✅ Ottimo lavoro!', `Streak attuale: ${count} giorni. Continua così!`);
    }
  } catch (e) {
    notify('🌙 Check serale', 'Hai registrato la tua sessione di oggi?');
  }
}

// ── alert pre-verifica ────────────────────────────────────────────────────────

async function alertPreVerifica() {
  const db = dbGetter ? dbGetter() : null;
  if (!db) return;

  try {
    const domani = getTomorrow();
    const verifiche = db.studio.getVerifiche().filter(v => v.date === domani);

    if (verifiche.length > 0) {
      const nomi = verifiche.map(v => `${v.subject} (${v.tipo || 'verifica'})`).join(', ');
      notify(
        '📅 Verifica domani!',
        `Hai: ${nomi}. Prepara il materiale stasera!`,
        true
      );
    }
  } catch (_) {}
}

// ── backup settimanale domenica 23:00 ─────────────────────────────────────────

async function backupSettimanale() {
  try {
    const { backupData } = require('./backup');
    await backupData(dbGetter);
    notify('💚 Backup completato', 'I tuoi dati Polylife sono al sicuro.');
  } catch (e) {
    notify('⚠️ Backup fallito', `Errore: ${e.message}`);
  }
}

// ── avvio pianificatore ───────────────────────────────────────────────────────

let jobs = [];

function start(dbGetterFn) {
  dbGetter = dbGetterFn;

  // 07:00 ogni giorno
  jobs.push(schedule.scheduleJob('0 7 * * *', briefingMattutino));

  // 20:00 ogni giorno
  jobs.push(schedule.scheduleJob('0 20 * * *', streakCheckSerale));

  // 19:00 ogni giorno — alert pre-verifica (guarda a domani)
  jobs.push(schedule.scheduleJob('0 19 * * *', alertPreVerifica));

  // Domenica 23:00 — backup settimanale
  jobs.push(schedule.scheduleJob('0 23 * * 0', backupSettimanale));

  console.log('  ✓ Notifiche pianificate (07:00 briefing, 19:00 pre-verifica, 20:00 streak, dom 23:00 backup)');
}

function stop() {
  jobs.forEach(j => j && j.cancel());
  jobs = [];
}

// Esporta anche le funzioni per test/trigger manuale via IPC
module.exports = { start, stop, briefingMattutino, streakCheckSerale, alertPreVerifica, backupSettimanale };
