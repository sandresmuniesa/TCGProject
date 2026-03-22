import { create } from "zustand";

type AppStoreState = {
  isOffline: boolean;
  selectedSetId: string | null;
  selectedCardId: string | null;
  setOfflineState: (isOffline: boolean) => void;
  setSelectedSetId: (setId: string | null) => void;
  setSelectedCardId: (cardId: string | null) => void;
};

export const useAppStore = create<AppStoreState>((set) => ({
  isOffline: false,
  selectedSetId: null,
  selectedCardId: null,
  setOfflineState: (isOffline) => set({ isOffline }),
  setSelectedSetId: (selectedSetId) => set({ selectedSetId }),
  setSelectedCardId: (selectedCardId) => set({ selectedCardId })
}));