/* A store is a plain object and a list of listeners. Four of them keep the
   app's states apart, so a wallet event can never reach into the race and a
   screen change can never touch the field. */

(function () {
  'use strict';

  function createStore(initial) {
    let state = Object.assign({}, initial);
    const subs = new Set();
    return {
      get: () => state,
      /** Merge a patch in and tell everyone; returns the new state. */
      set(patch) {
        const next = Object.assign({}, state, typeof patch === 'function' ? patch(state) : patch);
        const prev = state;
        state = next;
        for (const fn of subs) fn(next, prev);
        return next;
      },
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
    };
  }

  /** @type {{game: any, ui: any, wallet: any, chain: any}} */
  window.STORES = {
    game: createStore({
      config: null,
      race: null,          // Race
      result: null,        // RaceResult of the latest finished race
      recent: [],          // RaceResult[]
      top: [],
      chat: [],
      watching: 0,
      offset: 0,           // server clock minus ours
      schedule: []         // upcoming rounds
    }),
    ui: createStore({
      screen: 'home',      // home | lobby | countdown | race | results
      modal: null,         // 'wallet' | null
      toast: null,
      cameraMode: 'auto',
      sound: true,
      feed: []             // "0xA83… joined" lines for the lobby
    }),
    wallet: createStore({
      address: null, kind: null, label: '', chainId: null, network: '', demo: false, token: null,
      connecting: false, error: null
    }),
    chain: createStore({
      mode: 'demo',        // 'demo' | 'onchain'
      network: '',
      tx: null,            // Transaction in flight
      history: []
    })
  };
  window.createStore = createStore;
})();
