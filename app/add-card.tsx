import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { CARD_CONDITIONS, type CardCondition } from "@/constants/card-condition";
import { syncInitialCardsBySetCatalog } from "@/services/catalog-cards-sync";
import { searchCatalogCards } from "@/services/catalog-query";
import { getCatalogSetOptions } from "@/services/catalog-sets-query";
import { syncInitialSets } from "@/services/catalog-sync";
import { addCardToInventory } from "@/services/inventory-upsert";
import type { CatalogCardSearchResult } from "@/services/catalog-query";
import { useAppStore } from "@/store/app-store";

export default function AddCardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOffline = useAppStore((state) => state.isOffline);
  const setSelectedCardId = useAppStore((state) => state.setSelectedCardId);
  const setSelectedSetId = useAppStore((state) => state.setSelectedSetId);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetId, setLocalSelectedSetId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CatalogCardSearchResult | null>(null);
  const [quantityInput, setQuantityInput] = useState("1");
  const [condition, setCondition] = useState<CardCondition>("Near Mint");
  const [formError, setFormError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const setsSyncQuery = useQuery({
    queryKey: ["add-card-initial-sets-sync"],
    queryFn: () => syncInitialSets(),
    staleTime: Infinity,
    retry: 1
  });

  const cardsSyncQuery = useQuery({
    queryKey: ["add-card-initial-cards-sync"],
    queryFn: () => syncInitialCardsBySetCatalog(),
    enabled: setsSyncQuery.isSuccess,
    staleTime: Infinity,
    retry: 1
  });

  const setsQuery = useQuery({
    queryKey: ["catalog-set-options"],
    queryFn: () => getCatalogSetOptions(),
    enabled: cardsSyncQuery.isSuccess
  });

  const cardsQuery = useQuery({
    queryKey: ["catalog-search", searchTerm, selectedSetId],
    queryFn: () =>
      searchCatalogCards({
        term: searchTerm,
        setId: selectedSetId ?? undefined
      }),
    enabled: cardsSyncQuery.isSuccess
  });

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const visibleCards = useMemo(() => cards.slice(0, 50), [cards]);
  const setNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const set of setsQuery.data ?? []) {
      map.set(set.id, set.name);
    }

    return map;
  }, [setsQuery.data]);

  const addCardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCard) {
        throw new Error("Selecciona una carta antes de guardar.");
      }

      const quantity = Number.parseInt(quantityInput, 10);

      return addCardToInventory({
        cardId: selectedCard.id,
        setId: selectedCard.setId,
        number: selectedCard.number,
        name: selectedCard.name,
        quantity,
        condition,
        isOffline
      });
    },
    onSuccess: async (result) => {
      setSelectedCardId(result.cardId);
      setSelectedSetId(selectedCard?.setId ?? null);
      await queryClient.invalidateQueries({ queryKey: ["inventory-overview"] });
      router.back();
    }
  });

  function handleSelectCardForAdd() {
    if (!selectedCard) {
      return;
    }

    setFormError(null);
    addCardMutation.mutate(undefined, {
      onError: (error) => {
        setFormError(error instanceof Error ? error.message : "No se pudo guardar la carta en inventario.");
      }
    });
  }

  const syncErrorMessage =
    setsSyncQuery.error instanceof Error
      ? setsSyncQuery.error.message
      : cardsSyncQuery.error instanceof Error
        ? cardsSyncQuery.error.message
        : "No se pudo preparar el catalogo local.";

  useEffect(() => {
    if (!selectedCard) {
      return;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, [selectedCard]);

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">
        <View className="rounded-3xl bg-ink p-6">
          <Text className="text-3xl font-bold text-mist">Agregar carta</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-300">
            Busca por nombre o numero, filtra por set y selecciona la carta para iniciar el alta.
          </Text>
        </View>

        {setsSyncQuery.isLoading || cardsSyncQuery.isLoading ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-sm text-slate-700">Preparando catalogo local...</Text>
          </View>
        ) : null}

        {setsSyncQuery.isError || cardsSyncQuery.isError ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">{syncErrorMessage}</Text>
          </View>
        ) : null}

        {cardsSyncQuery.isSuccess ? (
          <>
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-sm font-semibold text-ink">Buscar en catalogo</Text>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Nombre o numero de carta"
                placeholderTextColor="#7b8794"
                className="mt-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
              />

              <Text className="mt-4 text-sm font-semibold text-ink">Set</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }}>
                <Pressable
                  onPress={() => setLocalSelectedSetId(null)}
                  className={`rounded-full px-3 py-2 ${selectedSetId == null ? "bg-ink" : "bg-slate-100"}`}
                >
                  <Text className={`text-xs font-semibold ${selectedSetId == null ? "text-mist" : "text-slate-700"}`}>
                    Todos
                  </Text>
                </Pressable>
                {(setsQuery.data ?? []).map((set) => {
                  const isActive = selectedSetId === set.id;

                  return (
                    <Pressable
                      key={set.id}
                      onPress={() => setLocalSelectedSetId(set.id)}
                      className={`rounded-full px-3 py-2 ${isActive ? "bg-ink" : "bg-slate-100"}`}
                    >
                      <Text className={`text-xs font-semibold ${isActive ? "text-mist" : "text-slate-700"}`}>
                        {set.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-sm font-semibold text-ink">Resultados ({cards.length})</Text>

              {cardsQuery.isLoading ? (
                <Text className="mt-2 text-sm text-slate-700">Buscando en catalogo...</Text>
              ) : null}

              {cardsQuery.isError ? (
                <Text className="mt-2 text-sm text-red-700">No se pudo consultar el catalogo local.</Text>
              ) : null}

              {cardsQuery.isSuccess && visibleCards.length === 0 ? (
                <Text className="mt-2 text-sm text-slate-700">No hay cartas para esos criterios.</Text>
              ) : null}

              <View className="mt-3 gap-2">
                {visibleCards.map((card) => {
                  const isSelected = selectedCard?.id === card.id;

                  return (
                    <Pressable
                      key={card.id}
                      onPress={() => setSelectedCard(card)}
                      className={`rounded-xl border p-3 ${isSelected ? "border-ink bg-slate-50" : "border-slate-200 bg-white"}`}
                    >
                      <View className="flex-row gap-3">
                        {card.imageUrl ? (
                          <Image
                            source={{ uri: card.imageUrl }}
                            className="h-16 w-12 rounded-md border border-slate-200 bg-slate-100"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-16 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-100">
                            <Text className="text-[10px] text-slate-500">Sin imagen</Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-ink">{card.name}</Text>
                          <Text className="mt-1 text-xs text-slate-600">
                            Set: {setNameById.get(card.setId) ?? "Set desconocido"}
                          </Text>
                          <Text className="text-xs text-slate-600">Numero: {card.number}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {cards.length > visibleCards.length ? (
                <Text className="mt-3 text-xs text-slate-500">
                  Mostrando {visibleCards.length} de {cards.length} resultados. Ajusta los filtros para precisar.
                </Text>
              ) : null}
            </View>

            {selectedCard ? (
              <View className="rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-sm font-semibold text-ink">Carta seleccionada</Text>
                <Text className="mt-2 text-base font-semibold text-ink">{selectedCard.name}</Text>
                <Text className="mt-1 text-sm text-slate-700">
                  Set: {setNameById.get(selectedCard.setId) ?? "Set desconocido"} · Numero: {selectedCard.number}
                </Text>

                <Text className="mt-4 text-sm font-semibold text-ink">Cantidad</Text>
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

                {isOffline ? (
                  <View className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <Text className="text-xs text-amber-800">
                      Sin conexion: la carta se guardara sin precio. Puedes actualizarlo desde el detalle cuando recuperes la conexion.
                    </Text>
                  </View>
                ) : null}

                {formError ? <Text className="mt-3 text-sm text-red-700">{formError}</Text> : null}

                <Pressable
                  onPress={handleSelectCardForAdd}
                  className={`mt-4 rounded-xl px-4 py-3 ${addCardMutation.isPending ? "bg-slate-400" : "bg-ink"}`}
                  disabled={addCardMutation.isPending}
                >
                  <Text className="text-center text-sm font-semibold text-mist">
                    {addCardMutation.isPending ? "Guardando..." : "Guardar a inventario"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}