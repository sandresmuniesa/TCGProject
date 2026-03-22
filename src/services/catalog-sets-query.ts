import { Platform } from "react-native";

const WEB_SETS_CACHE_KEY = "tcg:catalog:sets:v1";

export type CatalogSetOption = {
  id: string;
  name: string;
};

type CatalogSetsDeps = {
  platformOS: string;
  getNativeSets: () => Promise<CatalogSetOption[]>;
  readWebSets: () => CatalogSetOption[];
};

function readWebCacheArray<T>(key: string): T[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sortSets(sets: CatalogSetOption[]) {
  return [...sets].sort((a, b) => a.name.localeCompare(b.name));
}

const defaultDeps: CatalogSetsDeps = {
  platformOS: Platform.OS,
  getNativeSets: async () => {
    const { getAllSets } = await import("@/db/repositories/catalog-repository");
    const rows = await getAllSets();

    return rows.map((row) => ({
      id: row.id,
      name: row.name
    }));
  },
  readWebSets: () => readWebCacheArray<CatalogSetOption>(WEB_SETS_CACHE_KEY)
};

export async function getCatalogSetOptions(deps: CatalogSetsDeps = defaultDeps): Promise<CatalogSetOption[]> {
  if (deps.platformOS === "web") {
    return sortSets(deps.readWebSets());
  }

  return sortSets(await deps.getNativeSets());
}