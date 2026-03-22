import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { CARD_CONDITIONS, type CardCondition } from "@/constants/card-condition";
import { deleteInventoryCardEntry, getInventoryCardDetail, refreshInventoryCardPrice, updateInventoryCardEntry } from "@/services/inventory-detail";
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

function formatTimestamp(value: Date | null) {
  if (!value) {
    return "Sin actualizacion";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default function InventoryCardDetailScreen() {
  const params = useLocalSearchParams<{ inventoryId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOffline = useAppStore((state) => state.isOffline);
  const inventoryId = params.inventoryId;
  const [quantityInput, setQuantityInput] = useState("");
  const [condition, setCondition] = useState<CardCondition>("Near Mint");

  const detailQuery = useQuery({
    queryKey: ["inventory-card-detail", inventoryId],
    queryFn: () => {
      if (!inventoryId) {
        throw new Error("No se recibio el id de inventario.");
      }

      return getInventoryCardDetail(inventoryId);
    },
    enabled: Boolean(inventoryId)
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!inventoryId) {
        throw new Error("No se recibio el id de inventario.");
      }

      return refreshInventoryCardPrice(inventoryId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-card-detail", inventoryId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-overview"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!inventoryId) {
        throw new Error("No se recibio el id de inventario.");
      }

      const quantity = Number.parseInt(quantityInput, 10);

      return updateInventoryCardEntry({
        inventoryId,
        quantity,
        condition
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-card-detail", inventoryId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-overview"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!inventoryId) {
        throw new Error("No se recibio el id de inventario.");
      }

      await deleteInventoryCardEntry({ inventoryId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-overview"] });
      router.replace("/");
    }
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setQuantityInput(String(detailQuery.data.quantity));
    setCondition(detailQuery.data.condition);
  }, [detailQuery.data]);

  const variationClassName = useMemo(() => {
    if (!detailQuery.data || detailQuery.data.variationPercent == null) {
      return "text-slate-700";
    }

    return detailQuery.data.variationPercent >= 0 ? "text-emerald-700" : "text-red-700";
  }, [detailQuery.data]);

  const errorMessage =
    detailQuery.error instanceof Error
      ? detailQuery.error.message
      : "No se pudo cargar el detalle de carta.";

  const refreshErrorMessage =
    refreshMutation.error instanceof Error
      ? refreshMutation.error.message
      : "No se pudo refrescar el precio.";

  const updateErrorMessage =
    updateMutation.error instanceof Error
      ? updateMutation.error.message
      : "No se pudo actualizar la carta.";

  const deleteErrorMessage =
    deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : "No se pudo eliminar la carta del inventario.";

  return (
    <SafeAreaView className="flex-1 bg-mist">

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">
        {!inventoryId ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">No se pudo identificar la carta. Vuelve atras e intentalo de nuevo.</Text>
          </View>
        ) : null}

        {detailQuery.isLoading ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-sm text-slate-700">Cargando detalle de carta...</Text>
          </View>
        ) : null}

        {detailQuery.isError ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        ) : null}

        {detailQuery.data ? (
          <>
            <View className="rounded-3xl bg-ink p-6">
              <Text className="text-3xl font-bold text-mist">{detailQuery.data.name}</Text>
              <Text className="mt-2 text-sm text-slate-300">
                {detailQuery.data.setName} · #{detailQuery.data.number}
              </Text>
            </View>

            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <View className="items-center">
                {detailQuery.data.imageUrl ? (
                  <Image
                    source={{ uri: detailQuery.data.imageUrl }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100"
                    style={{ maxWidth: 300, aspectRatio: 0.72 }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    className="w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100"
                    style={{ maxWidth: 300, aspectRatio: 0.72 }}
                  >
                    <Text className="text-sm text-slate-500">Sin imagen disponible</Text>
                  </View>
                )}
              </View>

              <View className="mt-4 gap-2">
                <Text className="text-sm text-slate-700">Cantidad: {detailQuery.data.quantity}</Text>
                <Text className="text-sm text-slate-700">Estado: {detailQuery.data.condition}</Text>
                <Text className="text-sm text-slate-700">Precio guardado: {formatUsd(detailQuery.data.priceUsd)}</Text>
                <Text className="text-sm text-slate-700">Precio actual: {formatUsd(detailQuery.data.currentPriceUsd)}{isOffline ? " (ultimo conocido)" : ""}</Text>
                <Text className={`text-sm font-semibold ${variationClassName}`}>
                  Variacion: {formatVariation(detailQuery.data.variationPercent)}
                </Text>
                <Text className="text-sm text-slate-700">
                  Ultima actualizacion de precio: {formatTimestamp(detailQuery.data.priceTimestamp)}
                </Text>
              </View>

              <Pressable
                onPress={() => refreshMutation.mutate()}
                className={`mt-4 rounded-xl px-4 py-3 ${isOffline ? "bg-slate-300" : "bg-ink"}`}
                disabled={refreshMutation.isPending || isOffline}
              >
                <Text className={`text-center text-sm font-semibold ${isOffline ? "text-slate-500" : "text-mist"}`}>
                  {refreshMutation.isPending ? "Refrescando precio..." : isOffline ? "Sin conexion: precio no disponible" : "Refrescar precio"}
                </Text>
              </Pressable>

              {refreshMutation.isError ? <Text className="mt-3 text-sm text-red-700">{refreshErrorMessage}</Text> : null}

              <View className="mt-6 border-t border-slate-200 pt-4">
                <Text className="text-sm font-semibold text-ink">Editar cantidad y estado</Text>

                <Text className="mt-3 text-sm font-semibold text-ink">Cantidad</Text>
                <TextInput
                  value={quantityInput}
                  onChangeText={setQuantityInput}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor="#7b8794"
                  className="mt-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
                />

                <Text className="mt-4 text-sm font-semibold text-ink">Estado</Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {CARD_CONDITIONS.map((cardCondition) => {
                    const isActive = condition === cardCondition;

                    return (
                      <Pressable
                        key={cardCondition}
                        onPress={() => setCondition(cardCondition)}
                        className={`rounded-full px-3 py-2 ${isActive ? "bg-ink" : "bg-slate-100"}`}
                      >
                        <Text className={`text-xs font-semibold ${isActive ? "text-mist" : "text-slate-700"}`}>
                          {cardCondition}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => updateMutation.mutate()}
                  className="mt-4 rounded-xl bg-ink px-4 py-3"
                  disabled={updateMutation.isPending}
                >
                  <Text className="text-center text-sm font-semibold text-mist">
                    {updateMutation.isPending ? "Guardando cambios..." : "Guardar cambios"}
                  </Text>
                </Pressable>

                {updateMutation.isError ? <Text className="mt-3 text-sm text-red-700">{updateErrorMessage}</Text> : null}
                {updateMutation.isSuccess ? (
                  <Text className="mt-3 text-sm font-semibold text-emerald-700">Cambios guardados correctamente.</Text>
                ) : null}
              </View>

              <View className="mt-6 border-t border-slate-200 pt-4">
                <Pressable
                  onPress={() => deleteMutation.mutate()}
                  className="rounded-xl bg-red-600 px-4 py-3"
                  disabled={deleteMutation.isPending}
                >
                  <Text className="text-center text-sm font-semibold text-white">
                    {deleteMutation.isPending ? "Eliminando..." : "Eliminar de inventario"}
                  </Text>
                </Pressable>

                {deleteMutation.isError ? <Text className="mt-3 text-sm text-red-700">{deleteErrorMessage}</Text> : null}
              </View>
            </View>
          </>
        ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}