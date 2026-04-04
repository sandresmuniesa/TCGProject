import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { AddCardModal } from "@/components/add-card-modal";
import type { CatalogCardMetadata } from "@/services/types";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/services/collection-management", () => ({
  getCollectionsSummary: vi.fn()
}));

vi.mock("@/services/inventory-upsert", () => ({
  addCardToInventory: vi.fn()
}));

// Zustand store — default isOffline: false works as-is (no mock needed)

import * as collectionManagement from "@/services/collection-management";
import * as inventoryUpsert from "@/services/inventory-upsert";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const METADATA: CatalogCardMetadata = {
  id: "base1-4",
  name: "Charizard",
  number: "4",
  setId: "base1",
  setName: "Base Set",
  imageUrl: null
};

const COLLECTIONS = [
  { collectionId: "col-1", name: "Mi colección", totalCardsCount: 0, totalUniqueCardsCount: 0, totalCollectionValueUsd: 0, createdAt: new Date() },
  { collectionId: "col-2", name: "Colección 2",  totalCardsCount: 0, totalUniqueCardsCount: 0, totalCollectionValueUsd: 0, createdAt: new Date() }
];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false }
    }
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createClient()}>{children}</QueryClientProvider>;
}

function renderModal(props: Partial<React.ComponentProps<typeof AddCardModal>> = {}) {
  const onClose = vi.fn();
  const result = render(
    <AddCardModal visible={true} metadata={METADATA} onClose={onClose} {...props} />,
    { wrapper: Wrapper }
  );
  return { ...result, onClose };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddCardModal — collection loading", () => {
  it("shows quantity input with default value '1' when modal opens", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);

    renderModal();

    // The quantity input should have default value "1"
    await waitFor(() => {
      const input = screen.getByTestId("quantity-input");
      expect(input).toBeDefined();
    });

    const input = screen.getByTestId("quantity-input");
    expect((input as HTMLInputElement).value).toBe("1");
  });

  it("pre-selects the first collection from the query", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);

    renderModal();

    await waitFor(() => screen.getByText("Mi colección"));

    // First collection text is rendered (selected state makes it visible)
    expect(screen.getByText("Mi colección")).toBeTruthy();
    expect(screen.getByText("Colección 2")).toBeTruthy();
  });
});

describe("AddCardModal — form validation", () => {
  it("shows validation error and does not call addCardToInventory for non-numeric quantity", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);
    const addCardToInventory = vi.mocked(inventoryUpsert.addCardToInventory);

    renderModal();

    await waitFor(() => screen.getByText("Mi colección"));

    // Change quantity to invalid value
    const input = screen.getByTestId("quantity-input");
    fireEvent.change(input, { target: { value: "abc" } });

    // Click confirm
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmBtn);

    await waitFor(() => screen.getByTestId("form-error"));

    expect(screen.getByTestId("form-error").textContent).toMatch(/número entero/i);
    expect(addCardToInventory).not.toHaveBeenCalled();
  });

  it("shows validation error and does not call addCardToInventory for quantity <= 0", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);
    const addCardToInventory = vi.mocked(inventoryUpsert.addCardToInventory);

    renderModal();

    await waitFor(() => screen.getByText("Mi colección"));
    await act(async () => {});

    const input = screen.getByTestId("quantity-input");
    fireEvent.change(input, { target: { value: "0" } });

    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmBtn);

    await waitFor(() => screen.getByTestId("form-error"));

    expect(addCardToInventory).not.toHaveBeenCalled();
  });
});

describe("AddCardModal — confirm flow", () => {
  it("calls addCardToInventory with correct params on confirm", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);
    vi.mocked(inventoryUpsert.addCardToInventory).mockResolvedValue({
      inventoryId: "inv-1",
      cardId: "base1-4",
      quantity: 2,
      wasMerged: false,
      priceSource: "none"
    });

    const { onClose } = renderModal();

    await waitFor(() => screen.getByText("Mi colección"));
    await act(async () => {});

    // Set quantity to 2
    const input = screen.getByTestId("quantity-input");
    fireEvent.change(input, { target: { value: "2" } });

    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(inventoryUpsert.addCardToInventory).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: "base1-4",
          setId: "base1",
          number: "4",
          name: "Charizard",
          quantity: 2,
          condition: "Near Mint",
          collectionId: "col-1"
        })
      );
    });
  });

  it("calls onClose after a successful confirm", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);
    vi.mocked(inventoryUpsert.addCardToInventory).mockResolvedValue({
      inventoryId: "inv-1",
      cardId: "base1-4",
      quantity: 1,
      wasMerged: false,
      priceSource: "none"
    });

    const { onClose } = renderModal();

    await waitFor(() => screen.getByText("Mi colección"));
    await act(async () => {});

    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows error and does not call onClose when addCardToInventory fails", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);
    vi.mocked(inventoryUpsert.addCardToInventory).mockRejectedValue(new Error("Fallo de red"));

    const { onClose } = renderModal();

    await waitFor(() => screen.getByText("Mi colección"));
    await act(async () => {});

    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => screen.getByTestId("form-error"));

    expect(screen.getByTestId("form-error").textContent).toContain("Fallo de red");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("AddCardModal — cancel flow", () => {
  it("calls onClose without calling addCardToInventory when cancel is pressed", async () => {
    vi.mocked(collectionManagement.getCollectionsSummary).mockResolvedValue(COLLECTIONS);

    const { onClose } = renderModal();

    await waitFor(() => screen.getByText("Mi colección"));

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(inventoryUpsert.addCardToInventory).not.toHaveBeenCalled();
  });
});
