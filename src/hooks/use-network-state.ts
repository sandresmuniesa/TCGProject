import { useEffect } from "react";

import { Platform } from "react-native";

import { useAppStore } from "@/store/app-store";

export function useNetworkState() {
  const setOfflineState = useAppStore((state) => state.setOfflineState);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    function handleOnline() {
      setOfflineState(false);
    }

    function handleOffline() {
      setOfflineState(true);
    }

    setOfflineState(!navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOfflineState]);
}
