/**
 * Polylife — Migrazione localStorage → SQLite
 *
 * Questo script viene eseguito UNA SOLA VOLTA al primo avvio dopo l'aggiornamento.
 * Legge i dati dal localStorage di Chromium (via ipcRenderer) e li scrive nel DB.
 *
 * Flusso:
 *   1. main.js chiama ipcMain.handle('migrate-check')  → controlla se già migrato
 *   2. Se non migrato, la finestra carica migration.html che esegue questo script
 *   3. Lo script legge localStorage nel renderer, invia i dati via ipc al main
 *   4. main.js scrive i dati nel DB e segna la migrazione come completata
 *
 * NOTA: questo file va incluso in migration.html (non nei moduli normali)
 */

(async function runMigration() {
  const log = (msg) => {
    console.log('[Migration]', msg);
    const el = document.getElementById('migration-log');
    if (el) el.innerHTML += `<div>${msg}</div>`;
  };

  const setStatus = (msg, ok = true) => {
    const el = document.getElementById('migration-status');
    if (el) {
      el.textContent = msg;
      el.style.color = ok ? 'var(--color-text-success)' : 'var(--color-text-danger)';
    }
  };

  log('Avvio migrazione dati localStorage → SQLite...');

  try {
    // ── Raccolta dati da localStorage ─────────────────────────────────────────

    const payload = {};

    // Studio (prefisso sv4_)
    const studioKeys = ['rec', 'notes', 'ver', 'streak', 'compiti', 'voti'];
    payload.studio = {};
    studioKeys.forEach(k => {
      try {
        const raw = localStorage.getItem('sv4_' + k);
        if (raw) payload.studio[k] = JSON.parse(raw);
      } catch (e) {
        log(`  ⚠ sv4_${k}: impossibile leggere (${e.message})`);
      }
    });

    // Legge anche le note AI (sv4_ai_<id>)
    payload.studio.aiNotes = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sv4_ai_')) {
        try {
          payload.studio.aiNotes[key.replace('sv4_ai_', '')] = JSON.parse(localStorage.getItem(key));
        } catch (_) {}
      }
    }

    // Life RPG
    try {
      const raw = localStorage.getItem('leo_rpg_state_v2');
      payload.rpg = raw ? JSON.parse(raw) : null;
    } catch (e) {
      log(`  ⚠ leo_rpg_state_v2: ${e.message}`);
      payload.rpg = null;
    }

    // LEO Protocol
    const leoKeys = ['leo_checkin', 'leo_pr', 'leo_milestones', 'leo_notes'];
    payload.leo = {};
    leoKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) payload.leo[k.replace('leo_', '')] = JSON.parse(raw);
      } catch (e) {
        log(`  ⚠ ${k}: ${e.message}`);
      }
    });

    // Library
    try {
      const raw = localStorage.getItem('leo_library_v1');
      payload.library = raw ? JSON.parse(raw) : null;
    } catch (e) {
      log(`  ⚠ leo_library_v1: ${e.message}`);
      payload.library = null;
    }

    // Agora
    const agoraKeys = ['agora_conv_history', 'agora_char_memory', 'agora_custom_characters'];
    payload.agora = {};
    agoraKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) payload.agora[k.replace('agora_', '')] = JSON.parse(raw);
      } catch (e) {
        log(`  ⚠ ${k}: ${e.message}`);
      }
    });

    // Polymath OS (API key utente, feed state)
    try {
      payload.polymathApiKey = localStorage.getItem('polymath_gemini_key') || '';
      payload.feedState = JSON.parse(localStorage.getItem('polymath_feed_state') || 'null');
    } catch (_) {}

    // ── Invia al main process per scrivere nel DB ─────────────────────────────

    log('Dati raccolti, invio al database...');

    const result = await window.electronAPI.migrate(payload);

    if (result.success) {
      log(`✓ Migrazione completata: ${result.records} record scritti nel DB.`);
      log('I dati localStorage originali sono stati conservati come backup.');
      setStatus('Migrazione completata con successo!', true);

      // Piccola pausa per mostrare il messaggio, poi ricarica l'app
      setTimeout(() => {
        window.location.href = '/polymath_os_v9.html';
      }, 2000);
    } else {
      throw new Error(result.error || 'Errore sconosciuto');
    }

  } catch (err) {
    log(`✗ Errore durante la migrazione: ${err.message}`);
    setStatus('Errore migrazione — i dati originali sono al sicuro in localStorage.', false);
    console.error('[Migration] Errore completo:', err);
  }
})();
