import { useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { CARD_CONDITIONS } from "@/constants/card-condition";
import { AddCardModal } from "@/components/add-card-modal";
import {
  getCachedNmPrice,
  getCatalogCardMetadata,
  getCopiesForCard
} from "@/services/catalog-card-detail";
import { fetchCardConditionPrices, JustTcgNoMatchError } from "@/services/justtcg-client";
import { useAppStore } from "@/store/app-store";
import type { CardConditionPrices } from "@/services/types";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "No disponible";
  return USD_FORMATTER.format(value);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PricesSection({
  isOffline,
  cachedNm,
  pricesQuery
}: {
  isOffline: boolean;
  cachedNm: number | null | undefined;
  pricesQuery: ReturnType<typeof useQuery<CardConditionPrices>>;
}) {
  // Build the prices to display
  let displayPrices: CardConditionPrices | null = null;

  if (isOffline) {
    const nmPrice = cachedNm ?? null;
    displayPrices = {
      cardId: "",
      fetchedAt: new Date(),
      source: "cache_nm_only",
      prices: CARD_CONDITIONS.map((condition) => ({
        condition,
        priceUsd: condition === "Near Mint" ? nmPrice : null
      }))
    };
  } else if (pricesQuery.isSuccess) {
    displayPrices = pricesQuery.data;
  }

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="text-base font-semibold text-ink">Precios por condición</Text>

      {/* Offline banner */}
      {isOffline ? (
        <View className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          <Text className="text-xs font-medium text-amber-800">
            Sin conexión — mostrando último precio NM conocido
          </Text>
        </View>
      ) : null}

      {/* Loading */}
      {!isOffline && pricesQuery.isLoading ? (
        <View className="mt-3">
          {CARD_CONDITIONS.map((condition) => (
            <View key={condition} className="flex-row justify-between py-2 border-b border-slate-100">
              <Text className="text-sm text-slate-600">{condition}</Text>
              <Text className="text-sm text-slate-400">Cargando...</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* JustTcgNoMatchError — no retry */}
      {!isOffline && pricesQuery.isError && pricesQuery.error instanceof JustTcgNoMatchError ? (
        <View className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
          <Text className="text-sm text-slate-600">Precio no disponible para esta carta.</Text>
        </View>
      ) : null}

      {/* Other errors — with retry */}
      {!isOffline &&
      pricesQuery.isError &&
      !(pricesQuery.error instanceof JustTcgNoMatchError) ? (
        <View className="mt-3 gap-2">
          <View className="rounded-xl bg-red-50 border border-red-200 px-3 py-3">
            <Text className="text-sm text-red-700">No se pudieron cargar los precios.</Text>
          </View>
          <Pressable
            onPress={() => pricesQuery.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga de precios"
            className="rounded-xl bg-slate-800 px-4 py-2 self-start"
          >
            <Text className="text-sm font-semibold text-white">Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Price rows (offline synthetic or online success) */}
      {displayPrices ? (
        <View className="mt-3">
          {displayPrices.prices.map((entry) => (
            <View
              key={entry.condition}
              className="flex-row justify-between py-2 border-b border-slate-100 last:border-b-0"
              accessibilityRole="text"
              accessibilityLabel={`${entry.condition}: ${formatUsd(entry.priceUsd)}`}
            >
              <Text className="text-sm text-slate-700">{entry.condition}</Text>
              <Text className="text-sm font-semibold text-ink">
                {isOffline && entry.condition !== "Near Mint"
                  ? "No disponible"
                  : formatUsd(entry.priceUsd)}
              </Text>
            </View>
          ))}
          {isOffline && cachedNm == null ? (
            <Text className="mt-2 text-xs text-slate-500 italic">Sin precio conocido</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CatalogCardDetailScreen() {
  const params = useLocalSearchParams<{ cardId?: string; collectionId?: string }>();
  const router = useRouter();
  const isOffline = useAppStore((state) => state.isOffline);
  const cardId = params.cardId;
  const defaultCollectionId = params.collectionId;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 1 — Card metadata
  const metadataQuery = useQuery({
    queryKey: ["catalog-card-metadata", cardId],
    queryFn: () => {
      if (!cardId) throw new Error("cardId no disponible.");
      return getCatalogCardMetadata(cardId);
    },
    enabled: Boolean(cardId)
  });

  // 2 — Copies owned by the user
  const copiesQuery = useQuery({
    queryKey: ["inventory-copies", cardId],
    queryFn: () => {
      if (!cardId) throw new Error("cardId no disponible.");
      return getCopiesForCard(cardId);
    },
    enabled: Boolean(cardId)
  });

  // 3 — Condition prices (online only, requires metadata for name/number lookup)
  const metadata = metadataQuery.data ?? null;
  const pricesQuery = useQuery({
    queryKey: ["card-condition-prices", cardId],
    queryFn: () =>
      fetchCardConditionPrices({
        cardId: metadata!.id,
        cardName: metadata!.name,
        cardNumber: metadata!.number,
        setName: metadata!.setName
      }),
    enabled: !isOffline && Boolean(cardId) && Boolean(metadata),
    staleTime: Number(process.env.EXPO_PUBLIC_PRICES_STALE_TIME_MS ?? "3600000")
  });

  // 4 — Cached NM price for offline fallback
  const cachedPriceQuery = useQuery({
    queryKey: ["price-cache", cardId],
    queryFn: () => {
      if (!cardId) throw new Error("cardId no disponible.");
      return getCachedNmPrice(cardId);
    },
    enabled: isOffline && Boolean(cardId)
  });

  // ---------------------------------------------------------------------------
  // Early bail-outs
  // ---------------------------------------------------------------------------

  if (!cardId) {
    return (
      <SafeAreaView className="flex-1 bg-mist">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-red-700 text-center">
            No se pudo identificar la carta. Vuelve atrás e inténtalo de nuevo.
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="mt-4 rounded-xl bg-slate-800 px-5 py-3"
          >
            <Text className="text-sm font-semibold text-white">Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (metadataQuery.isSuccess && metadataQuery.data === null) {
    return (
      <SafeAreaView className="flex-1 bg-mist">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base font-semibold text-ink text-center">
            Carta no encontrada en el catálogo.
          </Text>
          <Text className="mt-1 text-sm text-slate-600 text-center">
            Es posible que el catálogo no esté sincronizado.
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="mt-4 rounded-xl bg-slate-800 px-5 py-3"
          >
            <Text className="text-sm font-semibold text-white">Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const copies = copiesQuery.data?.copies ?? [];
  const cachedNm = cachedPriceQuery.data ?? null;

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">

          {/* ----------------------------------------------------------------
              Header — card image + metadata
          ---------------------------------------------------------------- */}
          <View className="rounded-3xl bg-ink p-6">
            <View className="flex-row gap-4">
              {metadataQuery.isLoading ? (
                <View className="h-32 w-24 rounded-xl bg-slate-700" />
              ) : metadata?.imageUrl ? (
                <Image
                  source={{ uri: metadata.imageUrl }}
                  className="h-32 w-24 rounded-xl border border-slate-600 bg-slate-700"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-32 w-24 items-center justify-center rounded-xl border border-slate-600 bg-slate-700">
                  <Text className="text-xs text-slate-400">Sin imagen</Text>
                </View>
              )}

              <View className="flex-1 justify-center gap-1">
                {metadataQuery.isLoading ? (
                  <View className="h-5 w-3/4 rounded bg-slate-700" />
                ) : (
                  <>
                    <Text className="text-xl font-bold text-mist leading-tight">
                      {metadata?.name ?? "—"}
                    </Text>
                    <Text className="text-sm text-slate-400">#{metadata?.number}</Text>
                    <Text className="mt-1 text-xs text-slate-300">{metadata?.setName}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* ----------------------------------------------------------------
              Prices section (T-09, T-10, T-11)
          ---------------------------------------------------------------- */}
          <PricesSection
            isOffline={isOffline}
            cachedNm={cachedNm}
            pricesQuery={pricesQuery}
          />

          {/* ----------------------------------------------------------------
              Mis copias section
          ---------------------------------------------------------------- */}
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="text-base font-semibold text-ink">Mis copias</Text>

            {copiesQuery.isLoading ? (
              <View className="mt-3">
                <Text className="text-sm text-slate-500">Cargando copias...</Text>
              </View>
            ) : copies.length === 0 ? (
              <View className="mt-3">
                <Text className="text-sm text-slate-600">
                  No tienes esta carta en ninguna colección.
                </Text>
              </View>
            ) : (
              <View className="mt-3 gap-2">
                {copies.map((copy) => (
                  <Pressable
                    key={copy.inventoryId}
                    onPress={() => router.push(`/inventory/${copy.inventoryId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver entrada de inventario, colección ${copy.collectionName}, ${copy.quantity} ${copy.condition}`}
                    className="flex-row items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold text-ink">{copy.collectionName}</Text>
                      <Text className="text-xs text-slate-500">
                        {copy.condition} · {copy.quantity}{" "}
                        {copy.quantity === 1 ? "copia" : "copias"}
                      </Text>
                    </View>
                    <View className="items-end gap-0.5">
                      <Text className="text-sm font-semibold text-ink">
                        {formatUsd(copy.priceUsd)}
                      </Text>
                      <Text className="text-xs text-slate-400">›</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Total owned badge */}
            {copies.length > 0 && (copiesQuery.data?.totalQuantity ?? 0) > 0 ? (
              <View className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                <Text className="text-xs font-semibold text-emerald-800">
                  Total en inventario: {copiesQuery.data?.totalQuantity}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ----------------------------------------------------------------
              Agregar a colección button
          ---------------------------------------------------------------- */}
          <Pressable
            onPress={() => setIsAddModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Agregar carta a una colección"
            className="rounded-2xl bg-ink px-6 py-4 items-center"
          >
            <Text className="text-base font-semibold text-mist">Agregar a colección</Text>
          </Pressable>

        </View>
      </ScrollView>

      {/* Add card modal */}
      <AddCardModal
        visible={isAddModalOpen}
        metadata={metadata}
        defaultCollectionId={defaultCollectionId}
        onClose={() => setIsAddModalOpen(false)}
      />

    </SafeAreaView>
  );
}
