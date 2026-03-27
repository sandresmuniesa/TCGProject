import { useMemo, useState } from "react";

import { Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import type { CatalogSetOption } from "@/services/catalog-sets-query";

type SetPickerModalProps = {
  visible: boolean;
  sets: CatalogSetOption[];
  selectedSetIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
};

export function SetPickerModal({ visible, sets, selectedSetIds, onConfirm, onClose }: SetPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedSetIds));

  function handleOpen() {
    setLocalSelected(new Set(selectedSetIds));
    setSearchTerm("");
  }

  function toggleSet(id: string) {
    setLocalSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function handleSelectAll() {
    setLocalSelected(new Set());
  }

  function handleConfirm() {
    onConfirm(Array.from(localSelected));
  }

  const filteredSets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return sets;
    }

    return sets.filter((set) => set.name.toLowerCase().includes(term));
  }, [sets, searchTerm]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-mist">
        <View className="flex-1 px-4 pt-4">
          <View className="flex-row items-center justify-between pb-3">
            <Text className="text-xl font-bold text-ink">Filtrar por set</Text>
            <Pressable onPress={onClose} className="rounded-xl bg-slate-100 px-3 py-2">
              <Text className="text-sm font-semibold text-ink">Cancelar</Text>
            </Pressable>
          </View>

          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar set..."
            placeholderTextColor="#7b8794"
            className="mb-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
            autoFocus
          />

          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs text-slate-500">
              {localSelected.size === 0 ? "Todos los sets" : `${localSelected.size} seleccionado${localSelected.size > 1 ? "s" : ""}`}
            </Text>
            {localSelected.size > 0 ? (
              <Pressable onPress={handleSelectAll}>
                <Text className="text-xs font-semibold text-slate-500">Limpiar selección</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={handleSelectAll}
              className={`mb-1 flex-row items-center justify-between rounded-xl px-4 py-3 ${localSelected.size === 0 ? "bg-ink" : "bg-white border border-slate-200"}`}
            >
              <Text className={`text-sm font-semibold ${localSelected.size === 0 ? "text-mist" : "text-ink"}`}>
                Todos los sets
              </Text>
              {localSelected.size === 0 ? (
                <View className="h-5 w-5 items-center justify-center rounded-full bg-white">
                  <View className="h-3 w-3 rounded-full bg-ink" />
                </View>
              ) : null}
            </Pressable>

            {filteredSets.map((set) => {
              const isSelected = localSelected.has(set.id);

              return (
                <Pressable
                  key={set.id}
                  onPress={() => toggleSet(set.id)}
                  className={`mb-1 flex-row items-center justify-between rounded-xl px-4 py-3 ${isSelected ? "bg-ink" : "bg-white border border-slate-200"}`}
                >
                  <Text className={`flex-1 text-sm ${isSelected ? "font-semibold text-mist" : "text-ink"}`}>
                    {set.name}
                  </Text>
                  {isSelected ? (
                    <View className="ml-2 h-5 w-5 items-center justify-center rounded-full bg-white">
                      <View className="h-3 w-3 rounded-full bg-ink" />
                    </View>
                  ) : (
                    <View className="ml-2 h-5 w-5 rounded-full border-2 border-slate-300" />
                  )}
                </Pressable>
              );
            })}

            {filteredSets.length === 0 ? (
              <View className="rounded-xl border border-slate-200 bg-white p-4">
                <Text className="text-sm text-slate-500">No hay sets para "{searchTerm}"</Text>
              </View>
            ) : null}
          </ScrollView>

          <View className="pb-2 pt-3">
            <Pressable onPress={handleConfirm} className="rounded-xl bg-ink px-4 py-3">
              <Text className="text-center text-sm font-semibold text-mist">
                {localSelected.size === 0 ? "Aplicar (todos los sets)" : `Aplicar (${localSelected.size} set${localSelected.size > 1 ? "s" : ""})`}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
