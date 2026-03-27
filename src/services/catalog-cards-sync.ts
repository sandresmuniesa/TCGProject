import { Platform } from "react-native";

import { fetchCardsBySet, mapRemoteCardToRow } from "@/services/tcgdex-client";

const WEB_SETS_CACHE_KEY = "tcg:catalog:sets:v1";
const WEB_SET_CARDS_CACHE_KEY_PREFIX = "tcg:catalog:cards:set:v2:";

export type SyncCardsBySetResult = {
  setId: string;
  source: "cache" | "remote";
  count: number;
};

export type InitialCardsSyncResult = {
  setCount: number;
  cachedSetCount: number;
  downloadedSetCount: number;
  cardCount: number;
};

type SyncCardsBySetDeps = {
  fetchCardsBySet: typeof fetchCardsBySet;
  mapRemoteCardToRow: typeof mapRemoteCardToRow;
  getCardsBySet: (setId: string) => Promise<{ id: string }[]>;
  upsertCards: (cards: unknown[]) => Promise<void>;
};

type SyncInitialCardsDeps = SyncCardsBySetDeps & {
  getKnownSetIds: () => Promise<string[]>;
};

function getWebSetCardsCacheKey(setId: string) {
  return `${WEB_SET_CARDS_CACHE_KEY_PREFIX}${setId}`;
}

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

function writeWebCache(key: string, value: unknown) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function getWebKnownSetIds() {
  const sets = readWebCacheArray<{ id: string }>(WEB_SETS_CACHE_KEY);
  return sets.map((set) => set.id);
}

async function runSyncCardsBySet(setId: string, deps: SyncCardsBySetDeps): Promise<SyncCardsBySetResult> {
  const localCards = await deps.getCardsBySet(setId);

  if (localCards.length > 0) {
    return {
      setId,
      source: "cache",
      count: localCards.length
    };
  }

  const remoteCards = await deps.fetchCardsBySet(setId);
  const fetchedAt = new Date();

  if (remoteCards.length > 0) {
    await deps.upsertCards(remoteCards.map((card) => deps.mapRemoteCardToRow(card, fetchedAt)));
  }

  return {
    setId,
    source: "remote",
    count: remoteCards.length
  };
}

export async function syncCardsBySet(setId: string, deps?: SyncCardsBySetDeps): Promise<SyncCardsBySetResult> {
  if (deps) {
    return runSyncCardsBySet(setId, deps);
  }

  if (Platform.OS === "web") {
    const cacheKey = getWebSetCardsCacheKey(setId);
    const cachedCards = readWebCacheArray<{ id: string }>(cacheKey);

    if (cachedCards.length > 0) {
      return {
        setId,
        source: "cache",
        count: cachedCards.length
      };
    }

    const remoteCards = await fetchCardsBySet(setId);
    writeWebCache(cacheKey, remoteCards);

    return {
      setId,
      source: "remote",
      count: remoteCards.length
    };
  }

  const { getCardsBySet, upsertCards } = await import("@/db/repositories/catalog-repository");

  return runSyncCardsBySet(setId, {
    fetchCardsBySet,
    mapRemoteCardToRow,
    getCardsBySet,
    upsertCards
  });
}

async function runInitialCardsSync(deps: SyncInitialCardsDeps): Promise<InitialCardsSyncResult> {
  const setIds = await deps.getKnownSetIds();

  if (setIds.length === 0) {
    return {
      setCount: 0,
      cachedSetCount: 0,
      downloadedSetCount: 0,
      cardCount: 0
    };
  }

  const perSetResults: SyncCardsBySetResult[] = [];

  for (const setId of setIds) {
    perSetResults.push(await runSyncCardsBySet(setId, deps));
  }

  return {
    setCount: setIds.length,
    cachedSetCount: perSetResults.filter((result) => result.source === "cache").length,
    downloadedSetCount: perSetResults.filter((result) => result.source === "remote").length,
    cardCount: perSetResults.reduce((acc, result) => acc + result.count, 0)
  };
}

export async function syncInitialCardsBySetCatalog(deps?: SyncInitialCardsDeps): Promise<InitialCardsSyncResult> {
  if (deps) {
    return runInitialCardsSync(deps);
  }

  if (Platform.OS === "web") {
    return runInitialCardsSync({
      fetchCardsBySet,
      mapRemoteCardToRow,
      getCardsBySet: async (setId) => {
        const cacheKey = getWebSetCardsCacheKey(setId);
        return readWebCacheArray<{ id: string }>(cacheKey);
      },
      upsertCards: async (cards) => {
        const typedCards = cards as { setId: string }[];

        if (typedCards.length === 0) {
          return;
        }

        const setId = typedCards[0].setId;
        const cacheKey = getWebSetCardsCacheKey(setId);
        writeWebCache(cacheKey, cards);
      },
      getKnownSetIds: async () => getWebKnownSetIds()
    });
  }

  const { getAllSets, getCardsBySet, upsertCards, healCardImageUrls } = await import("@/db/repositories/catalog-repository");
  const result = await runInitialCardsSync({
    fetchCardsBySet,
    mapRemoteCardToRow,
    getCardsBySet,
    upsertCards,
    getKnownSetIds: async () => (await getAllSets()).map((set) => set.id)
  });

  await healCardImageUrls();

  return result;

}