import { Text, View } from "react-native";

import { useAppStore } from "@/store/app-store";

export function OfflineBanner() {
  const isOffline = useAppStore((state) => state.isOffline);

  if (!isOffline) {
    return null;
  }

  return (
    <View className="bg-amber-500 px-4 py-2">
      <Text className="text-center text-sm font-semibold text-white">
        Sin conexion. Mostrando datos guardados en el dispositivo.
      </Text>
    </View>
  );
}
