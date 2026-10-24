// In-memory attempt limiter for the login / signup / password-reset routes.
//
// Production runs a single PM2 process (ecosystem.config.js: instances 1,
// fork mode), so process memory is a sufficient shared store and avoids a
// schema migration. If the app is ever scaled to several processes each one
// keeps its own counters, which still bounds attempts (at max × processes).
// Counters reset on restart, which is acceptable for brute-force throttling.
//
// Kept free of Next.js imports so it stays unit-testable under `node --test`.

const MAX_TRACKED_KEYS = 50_000;

function isUsableKey(key) {
  return typeof key === "string" && key.length > 0 && !key.endsWith(":unknown");
}

export function createAttemptLimiter({ windowMs, max }) {
  const attempts = new Map();

  function recent(key, now) {
    const list = attempts.get(key);
    if (!list) return [];
    const fresh = list.filter((timestamp) => now - timestamp < windowMs);
    if (fresh.length === 0) {
      attempts.delete(key);
    } else if (fresh.length !== list.length) {
      attempts.set(key, fresh);
    }
    return fresh;
  }

  function prune(now) {
    for (const key of attempts.keys()) {
      recent(key, now);
    }
    // Still too many distinct keys (e.g. a spray of random usernames): drop
    // the oldest-inserted ones so memory stays bounded.
    const overflow = attempts.size - MAX_TRACKED_KEYS;
    if (overflow > 0) {
      let removed = 0;
      for (const key of attempts.keys()) {
        if (removed >= overflow) break;
        attempts.delete(key);
        removed += 1;
      }
    }
  }

  return {
    /** @returns {{ allowed: boolean, retryAfterSeconds: number }} */
    check(keys, now = Date.now()) {
      let retryAfterMs = 0;
      for (const key of keys.filter(isUsableKey)) {
        const list = recent(key, now);
        if (list.length >= max) {
          retryAfterMs = Math.max(retryAfterMs, list[list.length - max] + windowMs - now);
        }
      }
      return {
        allowed: retryAfterMs <= 0,
        retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 0),
      };
    },

    record(keys, now = Date.now()) {
      if (attempts.size >= MAX_TRACKED_KEYS) prune(now);
      for (const key of keys.filter(isUsableKey)) {
        const list = recent(key, now);
        list.push(now);
        attempts.set(key, list);
      }
    },

    reset(keys) {
      for (const key of keys.filter(isUsableKey)) {
        attempts.delete(key);
      }
    },
  };
}

// Module-level singletons survive across requests in the same process. Kept
// on globalThis so Next's dev-mode module reloading does not reset them.
const store = (globalThis.__startPrayAuthLimiters ??= {
  customerLogin: {
    account: createAttemptLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
    ip: createAttemptLimiter({ windowMs: 15 * 60 * 1000, max: 30 }),
  },
  adminLogin: {
    account: createAttemptLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
    ip: createAttemptLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  },
  // Generous per-IP cap: a church event can have many people signing up from
  // one shared Wi-Fi address.
  signup: {
    ip: createAttemptLimiter({ windowMs: 60 * 60 * 1000, max: 30 }),
  },
  passwordReset: {
    account: createAttemptLimiter({ windowMs: 60 * 60 * 1000, max: 3 }),
    ip: createAttemptLimiter({ windowMs: 60 * 60 * 1000, max: 5 }),
  },
});

export const authLimiters = store;

/**
 * Checks every limiter of a scope. `keys` maps a limiter name ("account",
 * "ip") to the key it should use; missing or "unknown" keys are skipped so an
 * unresolvable IP never locks every visitor out together.
 */
export function checkAuthLimit(scope, keys, now = Date.now()) {
  let retryAfterSeconds = 0;
  for (const [name, limiter] of Object.entries(scope)) {
    const result = limiter.check([keys[name]], now);
    if (!result.allowed) {
      retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
    }
  }
  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

export function recordAuthAttempt(scope, keys, now = Date.now()) {
  for (const [name, limiter] of Object.entries(scope)) {
    limiter.record([keys[name]], now);
  }
}

export function resetAuthAttempts(scope, keys) {
  for (const [name, limiter] of Object.entries(scope)) {
    limiter.reset([keys[name]]);
  }
}

export function tooManyAttemptsMessage(retryAfterSeconds) {
  const minutes = Math.max(Math.ceil(retryAfterSeconds / 60), 1);
  return `嘗試次數過多，請 ${minutes} 分鐘後再試。`;
}
