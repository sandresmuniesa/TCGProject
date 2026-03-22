import { useMemo, useState } from "react";

import { Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { filterInventoryItems, getInventoryOverview, getInventorySetFilterOptions } from "@/services/inventory-query";
import { useAppStore } from "@/store/app-store";

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function formatUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "No disponible";
  }

  return USD_FORMATTER.format(value);
}

function formatVariation(variationPercent: number | null) {
  if (variationPercent == null || !Number.isFinite(variationPercent)) {
    return "Sin variacion";
  }

  const sign = variationPercent > 0 ? "+" : "";
  return `${sign}${variationPercent.toFixed(2)}%`;
}

export default function HomeScreen() {
  const router = useRouter();
  const selectedCardId = useAppStore((state) => state.selectedCardId);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ["inventory-overview"],
    queryFn: () => getInventoryOverview()
  });

  const filteredItems = useMemo(() => {
    if (!inventoryQuery.data) {
      return [];
    }

    return filterInventoryItems(inventoryQuery.data.items, {
      term: searchTerm,
      setId: selectedSetId
    });
  }, [inventoryQuery.data, searchTerm, selectedSetId]);

  const setOptions = useMemo(() => {
    if (!inventoryQuery.data) {
      return [];
    }

    return getInventorySetFilterOptions(inventoryQuery.data.items);
  }, [inventoryQuery.data]);

  const filteredCardsCount = filteredItems.reduce((acc, item) => acc + item.quantity, 0);
  const filteredCollectionValue = filteredItems.reduce((acc, item) => {
    if (item.priceUsd == null || !Number.isFinite(item.priceUsd)) {
      return acc;
    }

    return acc + item.quantity * item.priceUsd;
  }, 0);

  const errorMessage =
    inventoryQuery.error instanceof Error
      ? inventoryQuery.error.message
      : "No se pudo cargar el inventario.";

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">
        <View className="rounded-3xl bg-ink p-6">
          <Text className="text-3xl font-bold text-mist">Mis cartas</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-300">
            Inventario personal con cantidad, estado, precio guardado y variacion frente al precio actual.
          </Text>
          <View className="mt-4 flex-row flex-wrap gap-3">
            <Pressable onPress={() => router.push("/add-card")} className="self-start rounded-xl bg-gold px-4 py-2">
              <Text className="text-sm font-semibold text-ink">Agregar carta</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/sets")} className="self-start rounded-xl border border-slate-500 px-4 py-2">
              <Text className="text-sm font-semibold text-mist">Explorar sets</Text>
            </Pressable>
          </View>
        </View>

        {selectedCardId ? (
          <View className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <Text className="text-sm font-semibold text-sky-900">Carta agregada correctamente al inventario.</Text>
            <Text className="mt-1 text-xs text-sky-800">Alta guardada en inventario correctamente.</Text>
          </View>
        ) : null}

        {inventoryQuery.isLoading ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-sm text-slate-700">Cargando inventario...</Text>
          </View>
        ) : null}

        {inventoryQuery.isError ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        ) : null}

        {inventoryQuery.data && inventoryQuery.data.items.length === 0 ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-6">
            <Text className="text-base font-semibold text-ink">Tu inventario esta vacio.</Text>
            <Text className="mt-2 text-sm leading-5 text-slate-700">
              Aun no tienes cartas guardadas. Agrega tu primera carta o explora el catalogo para ver las disponibles.
            </Text>
            <Pressable onPress={() => router.push("/add-card")} className="mt-4 self-start rounded-xl bg-gold px-4 py-2">
              <Text className="text-sm font-semibold text-ink">Agregar primera carta</Text>
            </Pressable>
          </View>
        ) : null}

        {inventoryQuery.data && inventoryQuery.data.items.length > 0 ? (
          <>
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-sm font-semibold text-ink">Buscar por nombre</Text>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Ej. Charizard"
                placeholderTextColor="#7b8794"
                className="mt-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
              />
              <Text className="mt-4 text-sm font-semibold text-ink">Filtrar por set</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }}>
                <Pressable
                  onPress={() => setSelectedSetId(null)}
                  className={`rounded-full px-3 py-2 ${selectedSetId == null ? "bg-ink" : "bg-slate-100"}`}
                >
                  <Text className={`text-xs font-semibold ${selectedSetId == null ? "text-mist" : "text-slate-700"}`}>
                    Todos
                  </Text>
                </Pressable>
                {setOptions.map((set) => {
                  const isActive = selectedSetId === set.setId;

                  return (
                    <Pressable
                      key={set.setId}
                      onPress={() => setSelectedSetId(set.setId)}
                      className={`rounded-full px-3 py-2 ${isActive ? "bg-ink" : "bg-slate-100"}`}
                    >
                      <Text className={`text-xs font-semibold ${isActive ? "text-mist" : "text-slate-700"}`}>
                        {set.setName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-xs uppercase tracking-wide text-slate-500">Total filtrado</Text>
                <Text className="mt-2 text-2xl font-bold text-ink">{filteredCardsCount}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-xs uppercase tracking-wide text-slate-500">Valor filtrado aprox.</Text>
                <Text className="mt-2 text-xl font-bold text-ink">{formatUsd(filteredCollectionValue)}</Text>
              </View>
            </View>

            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-xs uppercase tracking-wide text-slate-500">Totales de inventario completo</Text>
              <Text className="mt-2 text-sm text-slate-700">
                Cartas: {inventoryQuery.data.totalCardsCount} · Valor: {formatUsd(inventoryQuery.data.totalCollectionValueUsd)}
              </Text>
            </View>

            {filteredItems.length === 0 ? (
              <View className="rounded-2xl border border-slate-200 bg-white p-5">
                <Text className="text-base font-semibold text-ink">No hay resultados con esos filtros.</Text>
                <Text className="mt-1 text-sm text-slate-700">
                  Ajusta la busqueda o cambia el set para ver mas cartas.
                </Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const variationClassName =
                  item.variationPercent == null
                    ? "text-slate-600"
                    : item.variationPercent >= 0
                      ? "text-emerald-700"
                      : "text-red-700";

                return (
                  <Pressable
                    key={item.inventoryId}
                    onPress={() => router.push(`/inventory/${item.inventoryId}`)}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <View className="flex-row gap-3">
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          className="h-20 w-14 rounded-lg border border-slate-200 bg-slate-100"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="h-20 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
                          <Text className="text-xs text-slate-500">Sin imagen</Text>
                        </View>
                      )}

                      <View className="flex-1">
                        <Text className="text-base font-semibold text-ink">{item.name}</Text>
                        <Text className="mt-1 text-sm text-slate-600">
                          {item.setName} · #{item.number}
                        </Text>
                        <View className="mt-2 flex-row flex-wrap gap-2">
                          <View className="rounded-full bg-slate-100 px-2 py-1">
                            <Text className="text-xs font-medium text-slate-700">Cantidad: {item.quantity}</Text>
                          </View>
                          <View className="rounded-full bg-slate-100 px-2 py-1">
                            <Text className="text-xs font-medium text-slate-700">Estado: {item.condition}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View className="mt-4 gap-1">
                      <Text className="text-sm text-slate-700">Precio guardado: {formatUsd(item.priceUsd)}</Text>
                      <Text className="text-sm text-slate-700">Precio actual: {formatUsd(item.currentPriceUsd)}</Text>
                      <Text className={`text-sm font-semibold ${variationClassName}`}>
                        Variacion: {formatVariation(item.variationPercent)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}