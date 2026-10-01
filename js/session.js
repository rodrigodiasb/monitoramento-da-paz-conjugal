const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

const STORAGE_KEYS = {
  uid: "dsb:session:uid",
  startedAt: "dsb:session:startedAt",
  lastActivityAt: "dsb:session:lastActivityAt"
};

let stopCurrentGuard = null;
let expiring = false;
let lastPersistedActivity = 0;

function readNumber(key) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function startFreshSession(uid, now = Date.now()) {
  if (!uid) return;
  localStorage.setItem(STORAGE_KEYS.uid, uid);
  localStorage.setItem(STORAGE_KEYS.startedAt, String(now));
  localStorage.setItem(STORAGE_KEYS.lastActivityAt, String(now));
  lastPersistedActivity = now;
}

export function ensureSessionState(uid, now = Date.now()) {
  const storedUid = localStorage.getItem(STORAGE_KEYS.uid);
  const startedAt = readNumber(STORAGE_KEYS.startedAt);
  const lastActivityAt = readNumber(STORAGE_KEYS.lastActivityAt);

  if (storedUid !== uid || !startedAt || !lastActivityAt) {
    startFreshSession(uid, now);
    return { uid, startedAt: now, lastActivityAt: now };
  }

  return { uid, startedAt, lastActivityAt };
}

export function clearSessionState() {
  localStorage.removeItem(STORAGE_KEYS.uid);
  localStorage.removeItem(STORAGE_KEYS.startedAt);
  localStorage.removeItem(STORAGE_KEYS.lastActivityAt);
  lastPersistedActivity = 0;
}

export function getSessionExpiration(uid, now = Date.now()) {
  const state = ensureSessionState(uid, now);

  if (now - state.startedAt >= MAX_SESSION_MS) {
    return {
      expired: true,
      type: "maximum",
      message: "Sua sessão atingiu o limite de 8 horas por segurança. Faça login novamente."
    };
  }

  if (now - state.lastActivityAt >= IDLE_TIMEOUT_MS) {
    return {
      expired: true,
      type: "idle",
      message: "Sua sessão expirou após 30 minutos sem atividade. Faça login novamente."
    };
  }

  return { expired: false, type: null, message: "" };
}

function persistActivity(uid, now = Date.now()) {
  const storedUid = localStorage.getItem(STORAGE_KEYS.uid);
  if (storedUid !== uid) startFreshSession(uid, now);

  if (now - lastPersistedActivity < ACTIVITY_WRITE_THROTTLE_MS) return;
  localStorage.setItem(STORAGE_KEYS.lastActivityAt, String(now));
  lastPersistedActivity = now;
}

export function stopSessionGuard({ clear = false } = {}) {
  if (stopCurrentGuard) stopCurrentGuard();
  stopCurrentGuard = null;
  expiring = false;
  if (clear) clearSessionState();
}

export function startSessionGuard({ uid, onExpire }) {
  stopSessionGuard();
  if (!uid || typeof onExpire !== "function") return () => {};

  ensureSessionState(uid);
  expiring = false;

  const expireIfNeeded = async () => {
    if (expiring) return true;
    const expiration = getSessionExpiration(uid);
    if (!expiration.expired) return false;

    expiring = true;
    try {
      await onExpire(expiration);
    } finally {
      clearSessionState();
    }
    return true;
  };

  const handleActivity = async () => {
    if (await expireIfNeeded()) return;
    persistActivity(uid);
  };

  const handleVisibility = async () => {
    if (document.visibilityState !== "visible") return;
    await handleActivity();
  };

  const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];
  activityEvents.forEach(eventName => {
    window.addEventListener(eventName, handleActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", handleVisibility);

  const intervalId = window.setInterval(expireIfNeeded, CHECK_INTERVAL_MS);
  expireIfNeeded();

  const stop = () => {
    window.clearInterval(intervalId);
    activityEvents.forEach(eventName => {
      window.removeEventListener(eventName, handleActivity);
    });
    document.removeEventListener("visibilitychange", handleVisibility);
  };

  stopCurrentGuard = stop;
  return stop;
}

export const SESSION_LIMITS = Object.freeze({
  idleMinutes: IDLE_TIMEOUT_MS / 60_000,
  maxHours: MAX_SESSION_MS / 3_600_000
});
