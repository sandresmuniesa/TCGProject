import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { SetPickerModal } from "@/components/set-picker-modal";
import { syncInitialCardsBySetCatalog } from "@/services/catalog-cards-sync";
import { searchCatalogCards } from "@/services/catalog-query";
import { getCatalogSetOptions } from "@/services/catalog-sets-query";
import { PAGE_SIZE_OPTIONS, paginateResults, type PageSizeOption } from "@/services/pagination";
import { syncInitialSets } from "@/services/catalog-sync";
import { useAppStore } from "@/store/app-store";

export default function AddCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ collectionId?: string }>();
  const setSelectedCardId = useAppStore((state) => state.setSelectedCardId);
  const setSelectedSetId = useAppStore((state) => state.setSelectedSetId);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
  const [isSetPickerOpen, setIsSetPickerOpen] = useState(false);
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);
  const [page, setPage] = useState(0);

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
    queryKey: ["catalog-search", searchTerm, selectedSetIds],
    queryFn: () =>
      searchCatalogCards({
        term: searchTerm,
        setIds: selectedSetIds.length > 0 ? selectedSetIds : undefined
      }),
    enabled: cardsSyncQuery.isSuccess
  });

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const paginatedCards = useMemo(() => paginateResults(cards, page, pageSize), [cards, page, pageSize]);
  const visibleCards = paginatedCards.items;
  const setNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const set of setsQuery.data ?? []) {
      map.set(set.id, set.name);
    }

    return map;
  }, [setsQuery.data]);

  const syncErrorMessage =
    setsSyncQuery.error instanceof Error
      ? setsSyncQuery.error.message
      : cardsSyncQuery.error instanceof Error
        ? cardsSyncQuery.error.message
        : "No se pudo preparar el catalogo local.";

  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedSetIds]);

  useEffect(() => {
    if (page !== paginatedCards.currentPage) {
      setPage(paginatedCards.currentPage);
    }
  }, [page, paginatedCards.currentPage]);

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">
        <View className="rounded-3xl bg-ink p-6">
          <Text className="text-3xl font-bold text-mist">Agregar carta</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-300">
            Busca por nombre o numero, filtra por set y pulsa la carta para ver su detalle y añadirla a una colección.
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
              {(() => {
                const label =
                  selectedSetIds.length === 0
                    ? "Todos los sets"
                    : selectedSetIds.length === 1
                      ? (setsQuery.data?.find((s) => s.id === selectedSetIds[0])?.name ?? "1 set")
                      : `${selectedSetIds.length} sets seleccionados`;

                return (
                  <Pressable
                    onPress={() => setIsSetPickerOpen(true)}
                    className="mt-2 flex-row items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <Text className="text-sm text-ink">{label}</Text>
                    <Text className="text-xs text-slate-500">▼</Text>
                  </Pressable>
                );
              })()}

              {setsQuery.isSuccess ? (
                <SetPickerModal
                  visible={isSetPickerOpen}
                  sets={setsQuery.data ?? []}
                  selectedSetIds={selectedSetIds}
                  onConfirm={(ids) => {
                    setSelectedSetIds(ids);
                    setIsSetPickerOpen(false);
                  }}
                  onClose={() => setIsSetPickerOpen(false)}
                />
              ) : null}
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
                  const collectionParam = params.collectionId ? `?collectionId=${params.collectionId}` : "";

                  return (
                    <Pressable
                      key={card.id}
                      onPress={() => {
                        setSelectedCardId(card.id);
                        setSelectedSetId(card.setId);
                        router.push(`/card/${card.id}${collectionParam}`);
                      }}
                      className="rounded-xl border border-slate-200 bg-white p-3"
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

              {cardsQuery.isSuccess && cards.length > 0 ? (
                <View className="mt-4 flex-row flex-wrap items-center gap-2">
                  <Text className="text-xs font-semibold text-slate-600">Registros por pagina:</Text>
                  {PAGE_SIZE_OPTIONS.map((option) => {
                    const isActive = pageSize === option;

                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setPageSize(option);
                          setPage(0);
                        }}
                        className={`rounded-full px-3 py-2 ${isActive ? "bg-ink" : "bg-slate-100"}`}
                      >
                        <Text className={`text-xs font-semibold ${isActive ? "text-mist" : "text-slate-700"}`}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {cardsQuery.isSuccess && cards.length > 0 ? (
                <View className="mt-4 flex-row items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <Text className="text-xs text-slate-600">
                    Mostrando {paginatedCards.startItemNumber}-{paginatedCards.endItemNumber} de {cards.length}
                  </Text>
                  <Text className="text-xs text-slate-600">
                    Pagina {paginatedCards.totalPages === 0 ? 0 : paginatedCards.currentPage + 1} de {paginatedCards.totalPages}
                  </Text>
                </View>
              ) : null}

              {cardsQuery.isSuccess && paginatedCards.totalPages > 1 ? (
                <View className="mt-4 flex-row items-center justify-between gap-3">
                  <Pressable
                    onPress={() => setPage((currentPage) => Math.max(currentPage - 1, 0))}
                    disabled={paginatedCards.currentPage === 0}
                    className={`rounded-xl px-4 py-3 ${paginatedCards.currentPage === 0 ? "bg-slate-200" : "bg-slate-100"}`}
                  >
                    <Text className={`text-sm font-semibold ${paginatedCards.currentPage === 0 ? "text-slate-400" : "text-slate-700"}`}>
                      Anterior
                    </Text>
                  </Pressable>

                  <Text className="text-xs text-slate-600">
                    Pagina {paginatedCards.currentPage + 1} / {paginatedCards.totalPages}
                  </Text>

                  <Pressable
                    onPress={() => setPage((currentPage) => Math.min(currentPage + 1, paginatedCards.totalPages - 1))}
                    disabled={paginatedCards.currentPage >= paginatedCards.totalPages - 1}
                    className={`rounded-xl px-4 py-3 ${paginatedCards.currentPage >= paginatedCards.totalPages - 1 ? "bg-slate-200" : "bg-ink"}`}
                  >
                    <Text
                      className={`text-sm font-semibold ${paginatedCards.currentPage >= paginatedCards.totalPages - 1 ? "text-slate-400" : "text-mist"}`}
                    >
                      Siguiente
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}