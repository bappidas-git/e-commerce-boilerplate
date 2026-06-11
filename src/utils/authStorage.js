// =============================================================================
// Customer session storage ("user" + "token")
// =============================================================================
//
// Storage policy (intentional — see prompt_testing/09_authentication_and_session.md):
//   - Auth is SESSION-SCOPED by default (sessionStorage: per-tab, cleared when
//     the browser closes). Checking "Remember me" at login opts the session
//     into localStorage so it survives browser restarts.
//   - Cart / wishlist / theme intentionally use localStorage instead: they are
//     device-level preferences that must work for guests too.
//   - The admin session ("admin" + "adminToken") stays sessionStorage-only and
//     is NOT managed here.
//
// Reads check sessionStorage first so the most recent same-tab login always
// wins over an older remembered session.
// =============================================================================

const authStorage = {
  get(key) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },

  /** Write to the store chosen at login and evict the key from the other one. */
  set(key, value, remember = false) {
    if (remember) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },

  /** Update in place, wherever the current session lives. */
  update(key, value) {
    if (localStorage.getItem(key) !== null && sessionStorage.getItem(key) === null) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },

  remove(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  },
};

export default authStorage;
