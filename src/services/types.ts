export type RemoteSet = {
  id: string;
  name: string;
  logoUrl?: string | null;
  totalCards?: number | null;
};

export type RemoteCard = {
  id: string;
  setId: string;
  number: string;
  name: string;
  imageUrl?: string | null;
};

export type RemotePrice = {
  cardId: string;
  currentPriceUsd: number;
  previousPriceUsd?: number | null;
  fetchedAt: Date;
};

export type ConditionPriceEntry = {
  condition: import("@/constants/card-condition").CardCondition;
  priceUsd: number | null;
};

export type CardConditionPrices = {
  cardId: string;
  prices: ConditionPriceEntry[];
  fetchedAt: Date;
  source: "remote" | "cache_nm_only";
};

export type CatalogCardMetadata = {
  id: string;
  name: string;
  number: string;
  setId: string;
  setName: string;
  imageUrl: string | null;
};

export type MyCardCopy = {
  inventoryId: string;
  collectionId: string;
  collectionName: string;
  quantity: number;
  condition: import("@/constants/card-condition").CardCondition;
  priceUsd: number | null;
  priceTimestamp: Date | null;
};

export type MyCardCopiesSummary = {
  cardId: string;
  copies: MyCardCopy[];
  totalQuantity: number;
};