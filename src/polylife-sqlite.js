/**
 * PolyLife — SQLite-first persistence helpers (renderer)
 * Fallback: localStorage legacy / browser-only
 */
(function (global) {
  'use strict';

  async function sqliteFirstGet(moduleName, methodName, legacyKey, defaultValue) {
    try {
      const mod = global.window?.db?.[moduleName];
      if (mod?.[methodName]) {
        const data = await mod[methodName]();
        if (data !== null && data !== undefined) return data;
      }
      const raw = localStorage.getItem(legacyKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const saveFn = mod?.save || mod?.saveState || mod?.set || mod?.saveAll;
        if (saveFn) {
          try { await saveFn(parsed); } catch (e) { console.warn('[SQLite migrate]', moduleName, e); }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('[SQLite migration fallback]', moduleName, legacyKey, e);
    }
    return defaultValue;
  }

  async function sqliteFirstSet(moduleName, methodName, legacyKey, data) {
    try {
      const mod = global.window?.db?.[moduleName];
      if (mod?.[methodName]) {
        await mod[methodName](data);
        return;
      }
    } catch (e) {
      console.warn('[SQLite save fallback]', moduleName, legacyKey, e);
    }
    try { localStorage.setItem(legacyKey, JSON.stringify(data)); } catch (_) {}
  }

  async function migrateKvIfNeeded(name, legacyKey, saveFn) {
    if (global.window?.db?.migrations?.isDone) {
      const done = await global.window.db.migrations.isDone(name);
      if (done) return;
    }
    const hasSqlite = global.window?.db?.kv?.has
      ? await global.window.db.kv.has(legacyKey)
      : false;
    const raw = localStorage.getItem(legacyKey);
    if (!raw) {
      if (global.window?.db?.migrations?.markDone) await global.window.db.migrations.markDone(name);
      return;
    }
    if (hasSqlite) {
      if (global.window?.db?.migrations?.markDone) await global.window.db.migrations.markDone(name);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await saveFn(parsed);
      if (global.window?.db?.migrations?.markDone) await global.window.db.migrations.markDone(name);
    } catch (e) {
      console.warn('[AutoMigration]', name, e);
    }
  }

  async function runAutoMigrations() {
    if (!global.window?.db) return;

    const m = global.window.db.migrations;
    if (!m) return;

    const jobs = [
      {
        name: 'study',
        legacyKeys: ['sv4_rec', 'sv4_notes', 'sv4_ver', 'sv4_streak', 'sv4_compiti', 'sv4_voti'],
        async migrate() {
          if (await m.isDone('study')) return;
          let migrated = false;
          for (const key of this.legacyKeys) {
            const short = key.replace('sv4_', '');
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const existing = await global.window.db.study.getBlob(short);
            if (existing != null) continue;
            await global.window.db.study.setBlob(short, JSON.parse(raw));
            migrated = true;
          }
          if (migrated || !(localStorage.getItem('sv4_rec'))) await m.markDone('study');
        },
      },
      {
        name: 'flashcards',
        legacyKey: 'polylife_flashcards_v1',
        async migrate() {
          if (await m.isDone('flashcards')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('flashcards'); return; }
          const existing = await global.window.db.flashcards.getAll();
          if (existing?.length) { await m.markDone('flashcards'); return; }
          const cards = JSON.parse(raw);
          if (Array.isArray(cards) && cards.length) {
            if (global.window.db.flashcards.saveAll) await global.window.db.flashcards.saveAll(cards);
            else for (const c of cards) await global.window.db.flashcards.save(c);
          }
          await m.markDone('flashcards');
        },
      },
      {
        name: 'recovery',
        legacyKey: 'polylife_recovery_v1',
        async migrate() {
          if (await m.isDone('recovery')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('recovery'); return; }
          const existing = await global.window.db.recovery.getAll();
          if (existing?.length) { await m.markDone('recovery'); return; }
          const entries = JSON.parse(raw);
          if (Array.isArray(entries) && entries.length) await global.window.db.recovery.saveAll(entries);
          await m.markDone('recovery');
        },
      },
      {
        name: 'orchestrator',
        async migrate() {
          if (await m.isDone('orchestrator')) return;
          const planRaw = localStorage.getItem('polylife_orchestrator_plan_v1');
          const ovRaw = localStorage.getItem('polylife_daily_overrides_v2');
          const missionsRaw = localStorage.getItem('polylife_daily_missions_v1');
          const plans = planRaw ? JSON.parse(planRaw) : null;
          const overrides = ovRaw ? JSON.parse(ovRaw) : null;
          if (plans && global.window.db.orchestrator.saveAllPlans) {
            const existing = await global.window.db.orchestrator.getAllPlans();
            if (!Object.keys(existing || {}).length) await global.window.db.orchestrator.saveAllPlans(plans);
          }
          if (overrides) {
            const exOv = await global.window.db.orchestrator.getOverrides();
            if (!Object.keys(exOv || {}).length) await global.window.db.orchestrator.saveOverrides(overrides);
          }
          if (missionsRaw) {
            const missions = JSON.parse(missionsRaw);
            const existing = await global.window.db.dailyMissions.getRange('2020-01-01', '2099-12-31');
            if (!existing?.length && Array.isArray(missions)) {
              for (const mission of missions) await global.window.db.dailyMissions.save(mission);
            }
          }
          await m.markDone('orchestrator');
        },
      },
      {
        name: 'profile',
        legacyKey: 'polylife_operating_profile_v1',
        async migrate() {
          if (await m.isDone('profile')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('profile'); return; }
          const existing = await global.window.db.profile.get();
          if (existing) { await m.markDone('profile'); return; }
          await global.window.db.profile.save(JSON.parse(raw));
          await m.markDone('profile');
        },
      },
      {
        name: 'gamification',
        legacyKey: 'polylife_global_gamification_v1',
        async migrate() {
          if (await m.isDone('gamification')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('gamification'); return; }
          const existing = await global.window.db.gamification.getState();
          if (existing) { await m.markDone('gamification'); return; }
          await global.window.db.gamification.saveState(JSON.parse(raw));
          await m.markDone('gamification');
        },
      },
      {
        name: 'arte_musica',
        legacyKey: 'polylife_arte_musica_v1',
        async migrate() {
          if (await m.isDone('arte_musica')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('arte_musica'); return; }
          const existing = await global.window.db.creativity.getState();
          if (existing) { await m.markDone('arte_musica'); return; }
          await global.window.db.creativity.saveState(JSON.parse(raw));
          await m.markDone('arte_musica');
        },
      },
      {
        name: 'rpg',
        legacyKey: 'leo_rpg_state_v2',
        async migrate() {
          if (await m.isDone('rpg')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('rpg'); return; }
          const existing = await global.window.db.rpg.getState();
          if (existing) { await m.markDone('rpg'); return; }
          await global.window.db.rpg.saveState(JSON.parse(raw));
          await m.markDone('rpg');
        },
      },
      {
        name: 'library',
        legacyKey: 'leo_library_v1',
        async migrate() {
          if (await m.isDone('library')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('library'); return; }
          const existing = await global.window.db.libraryState.get();
          if (existing) { await m.markDone('library'); return; }
          await global.window.db.libraryState.save(JSON.parse(raw));
          await m.markDone('library');
        },
      },
      {
        name: 'command_center',
        legacyKey: 'polylife_daily_command_v1',
        async migrate() {
          if (await m.isDone('command_center')) return;
          const raw = localStorage.getItem(this.legacyKey);
          if (!raw) { await m.markDone('command_center'); return; }
          const existing = await global.window.db.commandCenter.getState();
          if (existing && Object.keys(existing).length) { await m.markDone('command_center'); return; }
          await global.window.db.commandCenter.saveState(JSON.parse(raw));
          await m.markDone('command_center');
        },
      },
    ];

    for (const job of jobs) {
      try { await job.migrate(); } catch (e) { console.warn('[AutoMigration failed]', job.name, e); }
    }
  }

  global.PolySQLite = {
    sqliteFirstGet,
    sqliteFirstSet,
    migrateKvIfNeeded,
    runAutoMigrations,
  };
})(typeof window !== 'undefined' ? window : global);
