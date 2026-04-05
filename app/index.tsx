import { useCallback, useState } from "react";

import { Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";

import {
  createCollection,
  deleteCollection,
  getCollectionsSummary,
  renameCollection,
  type CollectionSummary,
  type SortBy,
  type SortDir
} from "@/services/collection-management";

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function formatUsd(value: number) {
  return USD_FORMATTER.format(value);
}

const SORT_OPTIONS: Array<{ label: string; value: SortBy }> = [
  { label: "Fecha", value: "createdAt" },
  { label: "Nombre", value: "name" },
  { label: "Cartas", value: "totalCardsCount" },
  { label: "Valor", value: "totalCollectionValueUsd" }
];

export default function CollectionsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("ASC");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename modal
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete modal
  const [deletingCollection, setDeletingCollection] = useState<CollectionSummary | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const collectionsQuery = useQuery({
    queryKey: ["collections-summary", sortBy, sortDir],
    queryFn: () => getCollectionsSummary(sortBy, sortDir)
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["collections-summary"] });
    }, [queryClient])
  );

  const collections = collectionsQuery.data ?? [];

  function invalidateCollections() {
    queryClient.invalidateQueries({ queryKey: ["collections-summary"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createCollection(createName),
    onSuccess: () => {
      invalidateCollections();
      setIsCreateOpen(false);
      setCreateName("");
      setCreateError(null);
    },
    onError: (e) => {
      setCreateError(e instanceof Error ? e.message : "No se pudo crear la coleccion.");
    }
  });

  const renameMutation = useMutation({
    mutationFn: () => renameCollection(renamingId!, renameInput),
    onSuccess: () => {
      invalidateCollections();
      setRenamingId(null);
      setRenameInput("");
      setRenameError(null);
    },
    onError: (e) => {
      setRenameError(e instanceof Error ? e.message : "No se pudo renombrar la coleccion.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const targetId =
        deleteTargetId ??
        collections.find((c) => c.collectionId !== deletingCollection?.collectionId)?.collectionId ??
        "";
      return deleteCollection(deletingCollection!.collectionId, targetId);
    },
    onSuccess: () => {
      invalidateCollections();
      setDeletingCollection(null);
      setDeleteTargetId(null);
      setDeleteError(null);
    },
    onError: (e) => {
      setDeleteError(e instanceof Error ? e.message : "No se pudo eliminar la coleccion.");
    }
  });

  function openRename(collection: CollectionSummary) {
    setExpandedId(null);
    setRenamingId(collection.collectionId);
    setRenameInput(collection.name);
    setRenameError(null);
  }

  function openDelete(collection: CollectionSummary) {
    setExpandedId(null);
    setDeletingCollection(collection);
    setDeleteTargetId(null);
    setDeleteError(null);
  }

  const otherCollections = collections.filter((c) => c.collectionId !== deletingCollection?.collectionId);

  return (
    <SafeAreaView className="flex-1 bg-mist">
      <ScrollView
        contentContainerStyle={{ padding: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={collectionsQuery.isFetching}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["collections-summary"] })}
          />
        }
      >
        <View className="w-full self-center max-w-3xl gap-4">
          <View className="rounded-3xl bg-ink p-6">
            <Text className="text-3xl font-bold text-mist">Mis colecciones</Text>
            <Text className="mt-2 text-sm leading-5 text-slate-300">
              Organiza tus cartas en colecciones independientes.
            </Text>
            <View className="mt-4 flex-row flex-wrap gap-3">
              <Pressable
                onPress={() => {
                  setCreateName("");
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
                className="self-start rounded-xl bg-gold px-4 py-2"
              >
                <Text className="text-sm font-semibold text-ink">Nueva coleccion</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/sets")}
                className="self-start rounded-xl border border-slate-500 px-4 py-2"
              >
                <Text className="text-sm font-semibold text-mist">Explorar sets</Text>
              </Pressable>
            </View>
          </View>

          {/* Sort controls */}
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar por</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2"
              contentContainerStyle={{ gap: 8 }}
            >
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.value;

                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      if (sortBy === opt.value) {
                        setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
                      } else {
                        setSortBy(opt.value);
                        setSortDir("ASC");
                      }
                    }}
                    className={`rounded-full px-3 py-2 ${isActive ? "bg-ink" : "bg-slate-100"}`}
                  >
                    <Text className={`text-xs font-semibold ${isActive ? "text-mist" : "text-slate-700"}`}>
                      {opt.label}
                      {isActive ? (sortDir === "ASC" ? " ↑" : " ↓") : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {collectionsQuery.isLoading ? (
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="text-sm text-slate-700">Cargando colecciones...</Text>
            </View>
          ) : null}

          {collectionsQuery.isError ? (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <Text className="text-sm text-red-700">No se pudieron cargar las colecciones.</Text>
            </View>
          ) : null}

          {collectionsQuery.isSuccess && collections.length === 0 ? (
            <View className="rounded-2xl border border-slate-200 bg-white p-6">
              <Text className="text-base font-semibold text-ink">Aun no tienes colecciones.</Text>
              <Text className="mt-2 text-sm leading-5 text-slate-700">
                Crea tu primera coleccion para empezar a organizar tus cartas.
              </Text>
              <Pressable
                onPress={() => {
                  setCreateName("");
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
                className="mt-4 self-start rounded-xl bg-gold px-4 py-2"
              >
                <Text className="text-sm font-semibold text-ink">Crear primera coleccion</Text>
              </Pressable>
            </View>
          ) : null}

          {collections.map((collection) => {
            const isExpanded = expandedId === collection.collectionId;

            return (
              <View key={collection.collectionId} className="rounded-2xl border border-slate-200 bg-white">
                <Pressable
                  onPress={() => router.push(`/collections/${collection.collectionId}`)}
                  className="p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-semibold text-ink">{collection.name}</Text>
                      <Text className="text-sm text-slate-600">
                        {collection.totalUniqueCardsCount}{" "}
                        {collection.totalUniqueCardsCount === 1 ? "carta unica" : "cartas unicas"} ·{" "}
                        {collection.totalCardsCount} en total
                      </Text>
                      <Text className="text-sm text-slate-600">
                        Valor: {formatUsd(collection.totalCollectionValueUsd)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : collection.collectionId);
                      }}
                      className="ml-2 rounded-xl bg-slate-100 px-3 py-2"
                    >
                      <Text className="text-sm font-semibold text-slate-700">···</Text>
                    </Pressable>
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View className="flex-row gap-2 border-t border-slate-100 px-4 py-3">
                    <Pressable
                      onPress={() => openRename(collection)}
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2"
                    >
                      <Text className="text-center text-xs font-semibold text-slate-700">Renombrar</Text>
                    </Pressable>
                    {collections.length > 1 ? (
                      <Pressable
                        onPress={() => openDelete(collection)}
                        className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2"
                      >
                        <Text className="text-center text-xs font-semibold text-red-700">Eliminar</Text>
                      </Pressable>
                    ) : (
                      <View className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
                        <Text className="text-center text-xs text-slate-400">Unica coleccion</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Create collection modal */}
      <Modal
        visible={isCreateOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6">
            <Text className="text-lg font-bold text-ink">Nueva coleccion</Text>
            <TextInput
              value={createName}
              onChangeText={setCreateName}
              placeholder="Nombre de la coleccion"
              placeholderTextColor="#7b8794"
              maxLength={50}
              autoFocus
              className="mt-4 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
            />
            {createError ? <Text className="mt-2 text-sm text-red-700">{createError}</Text> : null}
            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => setIsCreateOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="flex-1 rounded-xl bg-ink px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-mist">
                  {createMutation.isPending ? "Creando..." : "Crear"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renamingId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingId(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6">
            <Text className="text-lg font-bold text-ink">Renombrar coleccion</Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Nuevo nombre"
              placeholderTextColor="#7b8794"
              maxLength={50}
              autoFocus
              className="mt-4 rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
            />
            {renameError ? <Text className="mt-2 text-sm text-red-700">{renameError}</Text> : null}
            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => setRenamingId(null)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => renameMutation.mutate()}
                disabled={renameMutation.isPending}
                className="flex-1 rounded-xl bg-ink px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-mist">
                  {renameMutation.isPending ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete modal */}
      <Modal
        visible={deletingCollection != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingCollection(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6">
            <Text className="text-lg font-bold text-ink">Eliminar coleccion</Text>
            <Text className="mt-2 text-sm text-slate-700">¿Eliminar "{deletingCollection?.name}"?</Text>

            {deletingCollection && deletingCollection.totalUniqueCardsCount > 0 ? (
              <>
                <Text className="mt-3 text-sm font-semibold text-ink">
                  Esta coleccion tiene {deletingCollection.totalCardsCount}{" "}
                  {deletingCollection.totalCardsCount === 1 ? "carta" : "cartas"}. Selecciona a donde moverlas:
                </Text>
                <ScrollView className="mt-2 max-h-48">
                  {otherCollections.map((c) => {
                    const isSelected = deleteTargetId === c.collectionId;

                    return (
                      <Pressable
                        key={c.collectionId}
                        onPress={() => setDeleteTargetId(c.collectionId)}
                        className={`mb-2 rounded-xl border px-3 py-3 ${isSelected ? "border-ink bg-ink" : "border-slate-300"}`}
                      >
                        <Text className={`text-sm font-semibold ${isSelected ? "text-mist" : "text-ink"}`}>
                          {c.name}
                        </Text>
                        <Text className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          {c.totalUniqueCardsCount} cartas unicas
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <Text className="mt-2 text-sm text-slate-600">
                Esta coleccion esta vacia. No hay cartas que reasignar.
              </Text>
            )}

            {deleteError ? <Text className="mt-2 text-sm text-red-700">{deleteError}</Text> : null}

            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => setDeletingCollection(null)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteMutation.mutate()}
                disabled={
                  deleteMutation.isPending ||
                  (deletingCollection != null &&
                    deletingCollection.totalUniqueCardsCount > 0 &&
                    deleteTargetId == null)
                }
                className={`flex-1 rounded-xl px-3 py-3 ${
                  deleteMutation.isPending ||
                  (deletingCollection != null &&
                    deletingCollection.totalUniqueCardsCount > 0 &&
                    deleteTargetId == null)
                    ? "bg-red-200"
                    : "bg-red-600"
                }`}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {deleteMutation.isPending ? "Eliminando..." : "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}