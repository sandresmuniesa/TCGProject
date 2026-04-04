import { PropsWithChildren, useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Platform } from "react-native";

import { useNetworkState } from "@/hooks/use-network-state";
import { bootstrapCollections } from "@/services/collections-bootstrap";

function NetworkStateWatcher() {
  useNetworkState();
  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => {
    if (Platform.OS === "web") {
      bootstrapCollections();
    }

    return new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 60_000,
          gcTime: 5 * 60_000
        }
      }
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkStateWatcher />
      {children}
    </QueryClientProvider>
  );
}