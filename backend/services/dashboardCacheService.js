const DASHBOARD_CACHE = new Map();

export function getDashboardCache(key) {
  const cached = DASHBOARD_CACHE.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    DASHBOARD_CACHE.delete(key);
    return null;
  }
  return cached.value;
}

export function setDashboardCache(key, value, ttlMs) {
  DASHBOARD_CACHE.set(key, {
    expiresAt: Date.now() + Math.max(0, Number(ttlMs) || 0),
    value,
  });
}

export function clearDashboardCache() {
  DASHBOARD_CACHE.clear();
}
