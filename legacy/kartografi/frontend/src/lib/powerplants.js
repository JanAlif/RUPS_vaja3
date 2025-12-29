import { api } from "./api";

const STORAGE_KEY = "rups2:powerplants";
const CACHE_TTL_MS = 30 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { byRegion: {} };
  } catch {
    return { byRegion: {} };
  }
}

function writeCache(cache) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getCachedPowerplants(region) {
  if (!region) return [];
  const cache = readCache();
  const entry = cache.byRegion?.[region];
  return entry?.items || [];
}

export async function loadPowerplantsForRegion(region, { force = false } = {}) {
  if (!region) return [];

  const cache = readCache();
  const entry = cache.byRegion?.[region];
  const now = Date.now();
  const isFresh = entry && now - entry.fetchedAt < CACHE_TTL_MS;

  //if (!force && isFresh) return entry.items || [];

  const items = await api.powerplants(region);
  const nextCache = {
    ...cache,
    byRegion: {
      ...(cache.byRegion || {}),
      [region]: { fetchedAt: now, items: Array.isArray(items) ? items : [] },
    },
  };
  writeCache(nextCache);
  return nextCache.byRegion[region].items;
}
