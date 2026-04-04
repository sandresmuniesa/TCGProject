import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { OfflineBanner } from "@/components/offline-banner";
import { AppProviders } from "@/providers/app-providers";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#101420" },
          headerTintColor: "#f4f7fb",
          contentStyle: { backgroundColor: "#f4f7fb" }
        }}
      >
        <Stack.Screen name="index" options={{ title: "Mis colecciones" }} />
        <Stack.Screen name="collections/[collectionId]" options={{ title: "Colección" }} />
        <Stack.Screen name="add-card" options={{ title: "Agregar carta" }} />
        <Stack.Screen name="sets/index" options={{ title: "Sets" }} />
        <Stack.Screen name="sets/[setId]" options={{ title: "Cartas del set" }} />
        <Stack.Screen name="inventory/[inventoryId]" options={{ title: "Detalle carta" }} />
        <Stack.Screen name="card/[cardId]" options={{ title: "Detalle del catálogo" }} />
      </Stack>
    </AppProviders>
  );
}