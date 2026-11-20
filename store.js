/* store.js — IndexedDB facade for Alberta Class 7 Practice 2026
   Classic script (no modules) so it works from file:// . All app DB
   access goes through window.DB. Falls back to an in-memory shim
   (with a visible banner) when IndexedDB is unavailable. */
(function () {
  'use strict';
  const DB_NAME = 'class7-practice';
  const DB_VERSION = 1;
  let db = null;
  let fallback = false;

  /* ---- in-memory fallback ---- */
  const mem = { state: new Map(), sessions: [], meta: new Map() };

  function openDB() {
    return new Promise(function (resolve) {
      if (db) { resolve(db); return; }
      if (!('indexedDB' in window)) { fallback = true; resolve(null); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { fallback = true; resolve(null); return; }
      req.onupgradeneeded = function (e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('state')) d.createObjectStore('state', { keyPath: 'qid' });
        if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { autoIncrement: true });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { fallback = true; resolve(null); };
    });
  }

  function tx(store, mode, fn) {
    if (fallback || !db) {                         // memory shim
      return Promise.resolve(fn({
        get: k => mem[store === 'state' ? 'state' : store === 'meta' ? 'meta' : 'x'].get ? Promise.resolve(mem[store === 'state' ? 'state' : 'meta'].get(k)) : Promise.resolve(null),
        put: v => { if (store === 'state') mem.state.set(v.qid, v); if (store === 'meta') mem.meta.set(v.key, v.value); return Promise.resolve(true); },
        getAll: () => Promise.resolve(store === 'state' ? Array.from(mem.state.values()) : []),
        clear: () => Promise.resolve(true),
      }));
    }
    return new Promise(function (resolve, reject) {
      const t = db.transaction(store, mode);
      const st = t.objectStore(store);
      let out;
      try { out = fn(st); } catch (e) { reject(e); return; }
      t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
      t.onerror = function () { reject(t.error); };
    });
  }

  window.DB = {
    ready: function () { return openDB().then(d => (fallback ? null : d)); },
    isFallback: () => fallback,

    getAllState: function () {
      if (fallback) return Promise.resolve(Array.from(mem.state.values()));
      return tx('state', 'readonly', s => s.getAll());
    },
    putState: function (rec) {
      if (fallback) { mem.state.set(rec.qid, rec); return Promise.resolve(); }
      return tx('state', 'readwrite', s => s.put(rec));
    },
    bulkPutState: function (recs) {
      if (fallback) { recs.forEach(r => mem.state.set(r.qid, r)); return Promise.resolve(); }
      return new Promise(function (resolve, reject) {
        const t = db.transaction('state', 'readwrite');
        const st = t.objectStore('state');
        recs.forEach(r => st.put(r));
        t.oncomplete = resolve; t.onerror = () => reject(t.error);
      });
    },
    getMeta: function (key) {
      if (fallback) return Promise.resolve(mem.meta.has(key) ? mem.meta.get(key) : undefined);
      return new Promise(function (resolve) {
        const t = db.transaction('meta', 'readonly');
        const r = t.objectStore('meta').get(key);
        t.oncomplete = function () { resolve(r.result ? r.result.value : undefined); };
        t.onerror = function () { resolve(undefined); };
      });
    },
    putMeta: function (key, value) {
      if (fallback) { mem.meta.set(key, value); return Promise.resolve(); }
      return tx('meta', 'readwrite', s => s.put({ key: key, value: value }));
    },
    getSessions: function () {
      if (fallback) return Promise.resolve(mem.sessions.slice());
      return new Promise(function (resolve) {
        const t = db.transaction('sessions', 'readonly');
        const r = t.objectStore('sessions').getAll();
        t.oncomplete = function () { resolve(r.result || []); };
        t.onerror = function () { resolve([]); };
      });
    },
    addSession: function (session) {
      if (fallback) { mem.sessions.push(session); return Promise.resolve(); }
      return tx('sessions', 'readwrite', s => s.put(session));
    },
    reset: function () {                       // wipe all progress: state, sessions, meta
      mem.state.clear(); mem.sessions.length = 0; mem.meta.clear();
      if (fallback || !db) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        const t = db.transaction(['state', 'sessions', 'meta'], 'readwrite');
        ['state', 'sessions', 'meta'].forEach(function (n) { t.objectStore(n).clear(); });
        t.oncomplete = function () { resolve(); };
        t.onerror = function () { reject(t.error); };
      });
    },
  };
})();
