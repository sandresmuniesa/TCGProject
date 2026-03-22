import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { filterCatalogExplorerSets, getCatalogExplorerSets } from "@/services/catalog-explorer";
import { syncInitialSets } from "@/services/catalog-sync";

export default function SetsExplorerScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const setsSyncQuery = useQuery({
    queryKey: ["catalog-explorer-initial-sets-sync"],
    queryFn: () => syncInitialSets(),
    staleTime: Infinity,
    retry: 1
  });

  const setsQuery = useQuery({
    queryKey: ["catalog-explorer-sets"],
    queryFn: () => getCatalogExplorerSets(),
    enabled: setsSyncQuery.isSuccess
  });

  const visibleSets = useMemo(
    () => filterCatalogExplorerSets(setsQuery.data ?? [], { term: searchTerm }),
    [searchTerm, setsQuery.data]
  );

  const errorMessage =
    setsSyncQuery.error instanceof Error
      ? setsSyncQuery.error.message
      : setsQuery.error instanceof Error
        ? setsQuery.error.message
        : "No se pudo cargar el explorador de sets.";

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="w-full self-center max-w-3xl gap-4">
        <View className="rounded-3xl bg-ink p-6">
          <Text className="text-3xl font-bold text-mist">Explorar sets</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-300">
            Recorre las expansiones disponibles y entra en cada set para revisar sus cartas y comprobar si ya las tienes.
          </Text>
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-ink">Buscar set</Text>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Ej. Base Set"
            placeholderTextColor="#7b8794"
            className="mt-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
          />
        </View>

        {setsSyncQuery.isLoading || setsQuery.isLoading ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-sm text-slate-700">Cargando sets del catalogo...</Text>
          </View>
        ) : null}

        {setsSyncQuery.isError || setsQuery.isError ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        ) : null}

        {setsQuery.isSuccess && visibleSets.length === 0 && searchTerm.trim().length > 0 ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-base font-semibold text-ink">No hay sets para ese filtro.</Text>
            <Text className="mt-1 text-sm text-slate-700">Prueba con otro nombre o borra la busqueda.</Text>
          </View>
        ) : null}

        {setsQuery.isSuccess && (setsQuery.data ?? []).length === 0 && searchTerm.trim().length === 0 ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-base font-semibold text-ink">No hay sets disponibles.</Text>
            <Text className="mt-1 text-sm text-slate-700">
              El catalogo todavia no se ha descargado. Conectate a internet para cargar los sets disponibles.
            </Text>
          </View>
        ) : null}

        {visibleSets.map((set) => (
          <Pressable
            key={set.id}
            onPress={() => router.push(`/sets/${set.id}`)}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">{set.name}</Text>
                <Text className="mt-1 text-xs text-slate-600">ID del set: {set.id}</Text>
              </View>

              <View className="items-end gap-2">
                <View className="rounded-full bg-slate-100 px-3 py-1">
                  <Text className="text-xs font-semibold text-slate-700">{set.ownedCardsCount} cartas tuyas</Text>
                </View>
                <View className="rounded-full bg-sky-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-sky-800">{set.ownedQuantity} copias</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}