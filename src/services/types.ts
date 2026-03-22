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