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

  // If region is a continent, fetch powerplants for the continent as a whole
  const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
  const cache = readCache();
  const now = Date.now();
  if (CONTINENTS.includes(region)) {
    // Get all country ISO codes in the continent
    let countryNames = [];
    try {
      const countriesGeo = await import("../assets/countries.json");
      countryNames = (countriesGeo.features || [])
        .filter(f => (f.properties?.CONTINENT || f.properties?.continent) === region)
        .map(f => f.properties?.NAME || f.properties?.ADMIN || f.properties?.name)
        .filter(Boolean);
    } catch (e) {
      countryNames = [];
    }

    // Fetch all powerplants for each country name
    let allPowerplants = [];
    for (const name of countryNames) {
      const entry = cache.byRegion?.[name];
      const isFresh = entry && now - entry.fetchedAt < CACHE_TTL_MS;
      //if (!force && isFresh) {
      //  allPowerplants = allPowerplants.concat(entry.items || []);
      //  continue;
      //}
      const items = await api.powerplants(name);
      const nextCache = {
        ...cache,
        byRegion: {
          ...(cache.byRegion || {}),
          [name]: { fetchedAt: now, items: Array.isArray(items) ? items : [] },
        },
      };
      writeCache(nextCache);
      allPowerplants = allPowerplants.concat(Array.isArray(items) ? items : []);
    }
    return allPowerplants;
  } else {
    // Otherwise, treat region as a country code
    const entry = cache.byRegion?.[region];
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
    return Array.isArray(items) ? items : [];
  }
}
