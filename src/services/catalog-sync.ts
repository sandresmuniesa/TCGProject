import { Platform } from "react-native";

import { mapRemoteSetToRow, fetchSets } from "@/services/tcgdex-client";

type SyncSource = "cache" | "remote";

export type InitialSetsSyncResult = {
  source: SyncSource;
  count: number;
};

const WEB_SETS_CACHE_KEY = "tcg:catalog:sets:v1";

type SyncInitialSetsDeps = {
  getAllSets: () => Promise<{ id: string }[]>;
  fetchSets: typeof fetchSets;
  upsertSets: (sets: ReturnType<typeof mapRemoteSetToRow>[]) => Promise<void>;
  mapRemoteSetToRow: typeof mapRemoteSetToRow;
};

function readWebSetsCacheCount() {
  if (typeof window === "undefined" || !window.localStorage) {
    return 0;
  }

  const rawValue = window.localStorage.getItem(WEB_SETS_CACHE_KEY);

  if (!rawValue) {
    return 0;
  }

  try {
    const parsed = JSON.parse(rawValue) as { id: string }[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function writeWebSetsCache(sets: Awaited<ReturnType<typeof fetchSets>>) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_SETS_CACHE_KEY, JSON.stringify(sets));
}

async function runInitialSetsSync(deps: SyncInitialSetsDeps): Promise<InitialSetsSyncResult> {
  const localSets = await deps.getAllSets();

  if (localSets.length > 0) {
    return {
      source: "cache",
      count: localSets.length
    };
  }

  const remoteSets = await deps.fetchSets();
  const fetchedAt = new Date();

  if (remoteSets.length > 0) {
    await deps.upsertSets(remoteSets.map((set) => deps.mapRemoteSetToRow(set, fetchedAt)));
  }

  return {
    source: "remote",
    count: remoteSets.length
  };
}

export async function syncInitialSets(deps?: SyncInitialSetsDeps): Promise<InitialSetsSyncResult> {
  if (deps) {
    return runInitialSetsSync(deps);
  }

  if (Platform.OS === "web") {
    const cachedSetsCount = readWebSetsCacheCount();

    if (cachedSetsCount > 0) {
      return {
        source: "cache",
        count: cachedSetsCount
      };
    }

    const remoteSets = await fetchSets();
    writeWebSetsCache(remoteSets);

    return {
      source: "remote",
      count: remoteSets.length
    };
  }

  const { getAllSets, upsertSets } = await import("@/db/repositories/catalog-repository");

  return runInitialSetsSync({
    getAllSets,
    fetchSets,
    upsertSets,
    mapRemoteSetToRow
  });
}