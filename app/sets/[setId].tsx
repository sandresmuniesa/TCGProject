import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { getCatalogExplorerSets, getCatalogSetCardsWithOwnership } from "@/services/catalog-explorer";
import { syncCardsBySet } from "@/services/catalog-cards-sync";
import { syncInitialSets } from "@/services/catalog-sync";

export default function SetCardsExplorerScreen() {
  const params = useLocalSearchParams<{ setId?: string }>();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const setId = params.setId;

  const setsSyncQuery = useQuery({
    queryKey: ["set-cards-initial-sets-sync"],
    queryFn: () => syncInitialSets(),
    staleTime: Infinity,
    retry: 1
  });

  const setCardsSyncQuery = useQuery({
    queryKey: ["set-cards-sync", setId],
    queryFn: () => {
      if (!setId) {
        throw new Error("No se recibio el set a explorar.");
      }

      return syncCardsBySet(setId);
    },
    enabled: setsSyncQuery.isSuccess && Boolean(setId),
    staleTime: Infinity,
    retry: 1
  });

  const setsQuery = useQuery({
    queryKey: ["catalog-explorer-sets"],
    queryFn: () => getCatalogExplorerSets(),
    enabled: setsSyncQuery.isSuccess
  });

  const cardsQuery = useQuery({
    queryKey: ["catalog-set-cards-with-ownership", setId, searchTerm],
    queryFn: () => {
      if (!setId) {
        throw new Error("No se recibio el set a explorar.");
      }

      return getCatalogSetCardsWithOwnership({
        setId,
        term: searchTerm
      });
    },
    enabled: setCardsSyncQuery.isSuccess && Boolean(setId)
  });

  const currentSet = useMemo(
    () => (setsQuery.data ?? []).find((set) => set.id === setId) ?? null,
    [setId, setsQuery.data]
  );

  const ownedCardsCount = useMemo(
    () => (cardsQuery.data ?? []).filter((card) => card.isOwned).length,
    [cardsQuery.data]
  );

  const errorMessage =
    setsSyncQuery.error instanceof Error
      ? setsSyncQuery.error.message
      : setCardsSyncQuery.error instanceof Error
        ? setCardsSyncQuery.error.message
        : cardsQuery.error instanceof Error
          ? cardsQuery.error.message
          : "No se pudo cargar el set.";

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">
        {!setId ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">No se pudo identificar el set. Vuelve atras e intentalo de nuevo.</Text>
          </View>
        ) : null}
        <View className="rounded-3xl bg-ink p-6">
          <Text className="text-3xl font-bold text-mist">{currentSet?.name ?? "Cartas del set"}</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-300">
            Filtra por nombre o numero y comprueba al instante si la carta ya esta en tu inventario.
          </Text>
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-ink">Buscar dentro del set</Text>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Ej. Pikachu o 25"
            placeholderTextColor="#7b8794"
            className="mt-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
          />
        </View>

        {cardsQuery.data ? (
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-xs uppercase tracking-wide text-slate-500">Cartas visibles</Text>
              <Text className="mt-2 text-2xl font-bold text-ink">{cardsQuery.data.length}</Text>
            </View>
            <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-xs uppercase tracking-wide text-slate-500">Ya en inventario</Text>
              <Text className="mt-2 text-2xl font-bold text-ink">{ownedCardsCount}</Text>
            </View>
          </View>
        ) : null}

        {setsSyncQuery.isLoading || setCardsSyncQuery.isLoading || cardsQuery.isLoading ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-sm text-slate-700">Cargando cartas del set...</Text>
          </View>
        ) : null}

        {setsSyncQuery.isError || setCardsSyncQuery.isError || cardsQuery.isError ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        ) : null}

        {cardsQuery.isSuccess && cardsQuery.data.length === 0 && searchTerm.trim().length > 0 ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-base font-semibold text-ink">No hay cartas para ese criterio.</Text>
            <Text className="mt-1 text-sm text-slate-700">Ajusta la busqueda para ver mas resultados.</Text>
          </View>
        ) : null}

        {cardsQuery.isSuccess && cardsQuery.data.length === 0 && searchTerm.trim().length === 0 ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-base font-semibold text-ink">Este set no tiene cartas disponibles.</Text>
            <Text className="mt-1 text-sm text-slate-700">El catalogo de este set no contiene cartas descargadas todavia.</Text>
          </View>
        ) : null}

        {(cardsQuery.data ?? []).map((card) => (
          <View key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row gap-3">
              {card.imageUrl ? (
                <Image
                  source={{ uri: card.imageUrl }}
                  className="h-20 w-14 rounded-lg border border-slate-200 bg-slate-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-20 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
                  <Text className="text-xs text-slate-500">Sin imagen</Text>
                </View>
              )}

              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">{card.name}</Text>
                <Text className="mt-1 text-sm text-slate-600">#{card.number}</Text>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-slate-100 px-3 py-1">
                    <Text className="text-xs font-semibold text-slate-700">ID: {card.id}</Text>
                  </View>

                  {card.isOwned ? (
                    <Pressable
                      onPress={() => {
                        if (card.inventoryId) {
                          router.push(`/inventory/${card.inventoryId}`);
                        }
                      }}
                      className="rounded-full bg-emerald-50 px-3 py-1"
                    >
                      <Text className="text-xs font-semibold text-emerald-800">
                        En inventario · {card.ownedQuantity}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="rounded-full bg-slate-100 px-3 py-1">
                      <Text className="text-xs font-semibold text-slate-700">No la tienes</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}