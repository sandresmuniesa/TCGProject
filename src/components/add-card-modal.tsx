import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CARD_CONDITIONS, type CardCondition } from "@/constants/card-condition";
import { getCollectionsSummary } from "@/services/collection-management";
import { addCardToInventory } from "@/services/inventory-upsert";
import { useAppStore } from "@/store/app-store";
import type { CatalogCardMetadata } from "@/services/types";

type AddCardModalProps = {
  visible: boolean;
  metadata: CatalogCardMetadata | null;
  onClose: () => void;
  defaultCollectionId?: string;
};

export function AddCardModal({ visible, metadata, onClose, defaultCollectionId }: AddCardModalProps) {
  const queryClient = useQueryClient();
  const isOffline = useAppStore((state) => state.isOffline);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState("1");
  const [condition, setCondition] = useState<CardCondition>("Near Mint");
  const [formError, setFormError] = useState<string | null>(null);

  const collectionsQuery = useQuery({
    queryKey: ["collections-summary"],
    queryFn: () => getCollectionsSummary()
  });

  const collections = collectionsQuery.data ?? [];

  // Reset form and pre-select collection when modal opens.
  // Priority: defaultCollectionId prop → first collection in the list.
  useEffect(() => {
    if (!visible) return;
    setQuantityInput("1");
    setCondition("Near Mint");
    setFormError(null);
    if (collections.length > 0) {
      const preferred =
        defaultCollectionId && collections.some((c) => c.collectionId === defaultCollectionId)
          ? defaultCollectionId
          : collections[0].collectionId;
      setSelectedCollectionId(preferred);
    }
  }, [visible, collections, defaultCollectionId]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!metadata) throw new Error("No hay datos de la carta.");
      if (!selectedCollectionId) throw new Error("Selecciona una colección.");

      const quantity = Number.parseInt(quantityInput, 10);
      if (Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("La cantidad debe ser un número entero mayor a 0.");
      }

      return addCardToInventory({
        cardId: metadata.id,
        setId: metadata.setId,
        setName: metadata.setName,
        number: metadata.number,
        name: metadata.name,
        quantity,
        condition,
        collectionId: selectedCollectionId,
        isOffline
      });
    },
    onSuccess: async () => {
      if (metadata) {
        await queryClient.invalidateQueries({ queryKey: ["inventory-copies", metadata.id] });
      }
      onClose();
    }
  });

  function handleConfirm() {
    const quantity = Number.parseInt(quantityInput, 10);
    if (Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      setFormError("La cantidad debe ser un número entero mayor a 0.");
      return;
    }
    setFormError(null);
    addMutation.mutate(undefined, {
      onError: (e) => {
        setFormError(e instanceof Error ? e.message : "No se pudo guardar la carta en inventario.");
      }
    });
  }

  function handleCancel() {
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">

          {/* Header */}
          <Text className="text-lg font-bold text-ink">
            Agregar a colección
          </Text>
          {metadata ? (
            <Text className="mt-1 text-sm text-slate-500">
              {metadata.name} · #{metadata.number}
            </Text>
          ) : null}

          {/* Collection picker */}
          <Text className="mt-5 text-sm font-semibold text-ink">Colección</Text>
          {collectionsQuery.isLoading ? (
            <Text className="mt-2 text-sm text-slate-500">Cargando colecciones...</Text>
          ) : collections.length === 0 ? (
            <Text className="mt-2 text-sm text-slate-600">No hay colecciones disponibles.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 160 }} className="mt-2">
              {collections.map((col) => {
                const isSelected = col.collectionId === selectedCollectionId;
                return (
                  <Pressable
                    key={col.collectionId}
                    onPress={() => setSelectedCollectionId(col.collectionId)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    className={`flex-row items-center gap-3 rounded-xl px-3 py-3 mb-1 ${
                      isSelected ? "bg-ink" : "bg-slate-100"
                    }`}
                  >
                    <Text className={`text-sm font-medium ${isSelected ? "text-white" : "text-ink"}`}>
                      {col.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Condition picker */}
          <Text className="mt-5 text-sm font-semibold text-ink">Condición</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
            <View className="flex-row gap-2">
              {CARD_CONDITIONS.map((cond) => {
                const isSelected = cond === condition;
                return (
                  <Pressable
                    key={cond}
                    onPress={() => setCondition(cond)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    className={`rounded-full px-3 py-1 border ${
                      isSelected
                        ? "bg-ink border-ink"
                        : "bg-white border-slate-300"
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${isSelected ? "text-white" : "text-slate-700"}`}>
                      {cond}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Quantity */}
          <Text className="mt-5 text-sm font-semibold text-ink">Cantidad</Text>
          <TextInput
            value={quantityInput}
            onChangeText={setQuantityInput}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor="#7b8794"
            accessibilityLabel="Cantidad"
            testID="quantity-input"
            className="mt-2 rounded-xl border border-slate-300 px-4 py-3 text-sm text-ink"
          />

          {/* Error */}
          {formError ? (
            <View className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
              <Text className="text-sm text-red-700" testID="form-error">{formError}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              className="flex-1 rounded-2xl border border-slate-300 py-4 items-center"
            >
              <Text className="text-sm font-semibold text-slate-700">Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={addMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Confirmar"
              className="flex-1 rounded-2xl bg-ink py-4 items-center"
            >
              <Text className="text-sm font-semibold text-white">
                {addMutation.isPending ? "Guardando..." : "Confirmar"}
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
}
