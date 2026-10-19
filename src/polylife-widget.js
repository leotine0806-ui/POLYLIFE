/**
 * Polylife — Widget Globale XP/Streak/Flashcard
 *
 * Inietta una barra floating in qualsiasi modulo HTML.
 * Aggiunge: streak count, XP guadagnati oggi, card da ripassare, backup status.
 *
 * Uso: <script src="/polylife-widget.js"></script>  (in fondo al body)
 *
 * Non dipende da framework. CSS inline + DOM manipulation.
 * Compatibile con tutti i moduli Polylife (Studio, LEO, RPG, Library, Agora).
 */

(function () {
  'use strict';

  // ── Stili ──────────────────────────────────────────────────────────────────
  const STYLES = `
    #pl-widget {
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      display: flex; align-items: center; gap: 10px;
      background: rgba(15, 15, 26, 0.92); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; padding: 8px 14px;
      backdrop-filter: blur(12px);
      font-family: 'Space Mono', 'Courier New', monospace;
      font-size: 12px; color: #e2e2ee;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      transition: opacity 0.3s; cursor: default;
      user-select: none;
    }
    #pl-widget:hover { opacity: 1 !important; }
    #pl-widget.hidden { display: none; }

    .pl-item { display: flex; align-items: center; gap: 5px; }
    .pl-sep { color: rgba(255,255,255,0.2); }

    .pl-streak { color: #fb923c; }
    .pl-streak.hot { color: #f97316; text-shadow: 0 0 8px rgba(249,115,22,0.6); }
    .pl-xp { color: #a78bfa; }
    .pl-cards { color: #f87171; }
    .pl-cards.ok { color: #4ade80; }
    .pl-backup { color: #64748b; }
    .pl-backup.done { color: #4ade80; }

    .pl-nav-btn {
      padding: 4px 10px; border-radius: 6px;
      background: rgba(124,111,224,0.15); border: 1px solid rgba(124,111,224,0.3);
      color: #a78bfa; cursor: pointer; font-family: inherit; font-size: 11px;
      transition: background 0.15s; margin-left: 4px;
    }
    .pl-nav-btn:hover { background: rgba(124,111,224,0.3); }

    @keyframes pl-pulse {
      0%,100% { opacity:1; } 50% { opacity:0.6; }
    }
    .pl-cards.alert { animation: pl-pulse 1.5s ease infinite; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // ── Costruzione DOM ────────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'pl-widget';
  widget.innerHTML = `
    <div class="pl-item pl-streak" id="pl-streak" title="Streak studio">🔥 —</div>
    <div class="pl-sep">·</div>
    <div class="pl-item pl-xp" id="pl-xp" title="XP guadagnati oggi">⚡ —</div>
    <div class="pl-sep">·</div>
    <div class="pl-item pl-cards" id="pl-cards" title="Flashcard da ripassare">🃏 —</div>
    <div class="pl-sep">·</div>
    <div class="pl-item" id="pl-missions" title="Missioni oggi" style="color:#a78bfa">⚔ —</div>
    <div class="pl-sep">·</div>
    <div class="pl-item pl-backup" id="pl-backup" title="Backup">💾</div>
    <button class="pl-nav-btn" onclick="window.location.href='/daily-missions.html'" title="Missioni">⚔️</button>
    <button class="pl-nav-btn" onclick="window.location.href='/hub-calendar.html'" title="Calendario hub">📅</button>
    <button class="pl-nav-btn" onclick="window.location.href='/flashcards.html'" title="Vai alle flashcard">📚</button>
    <button class="pl-nav-btn" onclick="window.location.href='/settings.html'" title="Impostazioni">⚙️</button>
  `;
  document.body.appendChild(widget);

  // ── Calcolo streak locale ──────────────────────────────────────────────────
  function calcStreakFromLS() {
    try {
      const raw = localStorage.getItem('sv4_streak');
      if (!raw) return 0;
      const dates = JSON.parse(raw);
      if (!Array.isArray(dates) || !dates.length) return 0;
      const sorted = [...dates].sort().reverse();
      const today  = new Date().toISOString().slice(0, 10);
      let count = 0, expected = today;
      for (const d of sorted) {
        const dd = typeof d === 'string' ? d : d.date;
        if (dd === expected) {
          count++;
          const prev = new Date(expected);
          prev.setDate(prev.getDate() - 1);
          expected = prev.toISOString().slice(0, 10);
        } else break;
      }
      return count;
    } catch (_) { return 0; }
  }

  // ── XP di oggi da localStorage ─────────────────────────────────────────────
  function getXPToday() {
    // XP pending da sessioni flashcard
    const pending = parseInt(localStorage.getItem('polylife_pending_xp') || '0');
    // XP da sessioni studio di oggi
    let studyXP = 0;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const sessions = JSON.parse(localStorage.getItem('sv4_rec') || '[]');
      studyXP = sessions
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + (s.xp || 0), 0);
    } catch (_) {}
    return pending + studyXP;
  }

  // ── Card da ripassare ──────────────────────────────────────────────────────
  async function getDueCount() {
    if (window.db?.flashcards?.getStats) {
      try {
        const st = await window.db.flashcards.getStats();
        if (st && st.due != null) return st.due;
      } catch (_) {}
    }
    try {
      const cards = JSON.parse(localStorage.getItem('polylife_flashcards_v1') || '[]');
      const today = new Date().toISOString().slice(0, 10);
      return cards.filter(c => !c.next_review_date || c.next_review_date <= today).length;
    } catch (_) { return 0; }
  }

  // ── Backup recente? ────────────────────────────────────────────────────────
  async function checkBackup() {
    const el = document.getElementById('pl-backup');
    if (!window.backup) { el.textContent = '💾 ?'; return; }
    try {
      const list = await window.backup.list();
      if (!list || !list.length) { el.textContent = '💾 mai'; return; }
      const lastDate = list[0].date;
      const today    = new Date().toISOString().slice(0, 10);
      const diff = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
      if (diff <= 7) {
        el.textContent = '💾 ✓';
        el.classList.add('done');
        el.title = `Backup: ${lastDate}`;
      } else {
        el.textContent = '💾 ⚠️';
        el.title = `Ultimo backup: ${lastDate} (${diff} giorni fa)`;
      }
    } catch (_) { el.textContent = '💾 ?'; }
  }

  // ── Aggiornamento UI ───────────────────────────────────────────────────────
  async function update() {
    // Streak
    let streak = 0;
    if (window.db) {
      try {
        const rows = await window.db.studio.getStreak();
        if (rows && rows.length) {
          const today = new Date().toISOString().slice(0, 10);
          const sorted = rows.map(r => r.date).sort().reverse();
          let count = 0, expected = today;
          for (const d of sorted) {
            if (d === expected) { count++; const prev = new Date(expected); prev.setDate(prev.getDate()-1); expected = prev.toISOString().slice(0,10); }
            else break;
          }
          streak = count;
        }
      } catch (_) { streak = calcStreakFromLS(); }
    } else {
      streak = calcStreakFromLS();
    }

    const streakEl = document.getElementById('pl-streak');
    streakEl.textContent = `🔥 ${streak}`;
    streakEl.title = `Streak: ${streak} giorn${streak === 1 ? 'o' : 'i'} consecutivi`;
    if (streak >= 7) streakEl.classList.add('hot');

    // XP
    const xp = getXPToday();
    const xpEl = document.getElementById('pl-xp');
    xpEl.textContent = `⚡ ${xp > 0 ? '+' + xp : '0'} XP`;

    // Card
    const due = await getDueCount();
    const cardsEl = document.getElementById('pl-cards');
    cardsEl.textContent = due > 0 ? `🃏 ${due}` : `🃏 ✓`;
    cardsEl.className = 'pl-item pl-cards' + (due === 0 ? ' ok' : due > 10 ? ' alert' : '');
    cardsEl.title = due > 0 ? `${due} card da ripassare` : 'Nessuna card in scadenza';

    // Missioni oggi
    async function getMissionsToday() {
      const today = new Date().toISOString().slice(0,10);
      if (window.db?.dailyMissions?.getByDate) {
        try {
          const todayM = await window.db.dailyMissions.getByDate(today);
          const done = todayM.filter(m => m.completed == 1 || m.completed === true).length;
          return { total: todayM.length, done };
        } catch (_) {}
      }
      try {
        const all = JSON.parse(localStorage.getItem('polylife_daily_missions_v1') || '[]');
        const todayM = all.filter(m => m.date === today);
        const done   = todayM.filter(m => m.completed == 1 || m.completed === true).length;
        return { total: todayM.length, done };
      } catch(_) { return { total: 0, done: 0 }; }
    }
    const miss = await getMissionsToday();
    const missEl = document.getElementById('pl-missions');
    if (missEl) {
      if (miss.total === 0) { missEl.textContent = '⚔ —'; }
      else if (miss.done === miss.total) { missEl.textContent = `⚔ ✓`; missEl.style.color = '#4ade80'; }
      else { missEl.textContent = `⚔ ${miss.done}/${miss.total}`; }
      missEl.title = `Missioni oggi: ${miss.done}/${miss.total}`;
    }

    // Backup (asincrono)
    checkBackup();
  }

  // ── Toggle con doppio click ────────────────────────────────────────────────
  let tapCount = 0;
  widget.addEventListener('dblclick', () => {
    widget.style.opacity = widget.style.opacity === '0.2' ? '1' : '0.2';
  });

  // ── Avvio ──────────────────────────────────────────────────────────────────
  // Aspetta che window.db sia disponibile (caricato da preload.js)
  setTimeout(update, 800);
  // Aggiorna ogni 3 minuti
  setInterval(update, 3 * 60 * 1000);

})();
