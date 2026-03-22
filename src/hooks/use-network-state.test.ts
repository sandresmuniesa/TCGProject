import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppStore } from "@/store/app-store";
import { useNetworkState } from "./use-network-state";

describe("useNetworkState", () => {
  beforeEach(() => {
    useAppStore.setState({ isOffline: false });
  });

  it("sets isOffline to true when navigator.onLine is false on mount", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    const { unmount } = renderHook(() => useNetworkState());

    expect(useAppStore.getState().isOffline).toBe(true);
    unmount();
  });

  it("sets isOffline to false when navigator.onLine is true on mount", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    useAppStore.setState({ isOffline: true });

    const { unmount } = renderHook(() => useNetworkState());

    expect(useAppStore.getState().isOffline).toBe(false);
    unmount();
  });

  it("updates isOffline when offline event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    const { unmount } = renderHook(() => useNetworkState());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(useAppStore.getState().isOffline).toBe(true);
    unmount();
  });

  it("updates isOffline when online event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    const { unmount } = renderHook(() => useNetworkState());

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(useAppStore.getState().isOffline).toBe(false);
    unmount();
  });

  it("removes event listeners on unmount", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    const { unmount } = renderHook(() => useNetworkState());
    unmount();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(useAppStore.getState().isOffline).toBe(false);
  });
});
