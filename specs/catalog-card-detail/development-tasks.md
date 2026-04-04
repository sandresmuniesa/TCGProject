# Tareas de Desarrollo — Detalle de Carta desde Catálogo

---

## Resumen

Este documento desglosa en tareas ejecutables el plan de implementación de la feature **catalog-card-detail**. Cubre la pantalla `/card/[cardId]`, el servicio de precios por condición vía JustTCG, la capa de datos multi-plataforma, el modal de alta inline y la modificación del explorador de sets.

**Fuentes utilizadas:**

| Archivo | Tipo |
|---|---|
| `specs/catalog-card-detail/catalog-card-detail-spec.md` | Feature spec |
| `specs/catalog-card-detail/implementation-plan.md` | Plan de implementación |
| `specs/tech-stack.md` | Spec global — arquitectura y stack |
| `specs/product-summary.md` | Spec global — visión del producto |

---

## Supuestos

| ID | Supuesto |
|---|---|
| A-01 | Los tipos `ConditionPriceEntry` y `CardConditionPrices` se añaden al archivo de tipos existente `src/services/types.ts`, que ya centraliza tipos como `RemotePrice`. Si ese archivo no existe o ha sido renombrado, se crea uno en la misma ruta. |
| A-02 | Cada tarea asume que la rama está limpia y el proyecto compila sin errores antes de comenzar. |
| A-03 | Los tests se ejecutan con `vitest`. El setup de mocks de plataforma web/native sigue el patrón ya establecido en los tests existentes (`catalog-explorer.test.ts`, `inventory-query.test.ts`). |
| A-04 | El componente `AddCardModal` se crea en `src/components/add-card-modal.tsx` desde cero. No toma código referencial de `add-card.tsx`, aunque sí reutiliza el servicio `addCardToInventory` y el hook `getCollectionsSummary`. |
| A-05 | La variable de entorno `EXPO_PUBLIC_PRICES_STALE_TIME_MS` se añade a `.env.example` como parte de T-02. Su ausencia en tiempo de ejecución hace que la función retorne el valor por defecto de 3 600 000 ms (1 hora) sin error. |

---

## Sistema de estados

Cada tarea dispone de un campo **Estado** con los siguientes valores posibles:

| Estado | Significado |
|---|---|
| `Pendiente` | La tarea no ha comenzado. |
| `En progreso` | La tarea está siendo trabajada activamente. Solo debe haber una tarea `En progreso` a la vez por desarrollador. |
| `Bloqueada` | La tarea no puede avanzar hasta que se resuelva una dependencia o impedimento externo. |
| `Completada` | La tarea está terminada y sus criterios de aceptación han sido verificados. |

---

## Tareas por fase

---

### Fase 1 — Servicio de precios por condición

**Objetivo:** Extender `justtcg-client.ts` con una función que obtenga los precios de las 5 condiciones en una sola llamada y los mapee al tipo del dominio.

| ID | Tarea | Estado | Descripción | Inputs | Entregable | Criterio de aceptación | Dependencias | Owner | Spec origen |
|---|---|---|---|---|---|---|---|---|---|
| T-01 | Añadir tipos de dominio para precios por condición | Completada | Añadir los tipos `ConditionPriceEntry` y `CardConditionPrices` a `src/services/types.ts`. `ConditionPriceEntry` contiene `condition` (unión de las 5 condiciones del dominio) y `priceUsd: number \| null`. `CardConditionPrices` contiene `cardId`, `prices: ConditionPriceEntry[]`, `fetchedAt`, y `source: "remote" \| "cache_nm_only"`. Exportar ambos. | `src/services/types.ts` (archivo existente), `catalog-card-detail-spec.md` §4.1 | Tipos `ConditionPriceEntry` y `CardConditionPrices` exportados desde `src/services/types.ts`, proyecto compila sin errores TypeScript. | (1) Los nombres de condición en `ConditionPriceEntry` son exactamente: `"Near Mint"`, `"Lightly Played"`, `"Moderately Played"`, `"Heavily Played"`, `"Damaged"`. (2) `source` discrimina entre datos en tiempo real y degradación offline. (3) `tsc --noEmit` no reporta errores. | — | — | Feature: `catalog-card-detail-spec.md` §4.1 |
| T-02 | Implementar `fetchCardConditionPrices` en `justtcg-client.ts` | Completada | Nueva función `fetchCardConditionPrices(params: JustTcgPriceLookupParams): Promise<CardConditionPrices>` en `src/services/justtcg-client.ts`. Pasos: (1) Llamar a JustTCG con `condition: ["NM","LP","MP","HP","DMG"]`; (2) Reutilizar `pickBestCard` para seleccionar la carta; (3) Para cada una de las 5 condiciones del dominio, filtrar los variants correspondientes y aplicar RN-05: elegir el variant de tipo `Normal` si existe con precio no nulo, si no el de precio más alto; si ningún variant tiene precio, `priceUsd = null`; (4) Construir y retornar `CardConditionPrices` con `source = "remote"`; (5) Si el precio NM es no nulo, persistir en `price_cache` mediante `upsertPriceCache` (reutilizar la import existente). No modificar `fetchCardPrice`. Añadir `EXPO_PUBLIC_PRICES_STALE_TIME_MS` a `.env.example` con valor `3600000`. | `src/services/justtcg-client.ts`, `src/db/repositories/price-cache-repository.ts` (para `upsertPriceCache`), `catalog-card-detail-spec.md` §5.5, RN-05, RN-06, S-07 | Función `fetchCardConditionPrices` exportada desde `justtcg-client.ts`. `.env.example` actualizado con `EXPO_PUBLIC_PRICES_STALE_TIME_MS=3600000`. | (1) Con conexión y match, retorna `CardConditionPrices` con las 5 entradas de condición. (2) Condición sin ningún variant retorna `priceUsd: null` para esa entrada. (3) Múltiples variants para la misma condición: se elige el de tipo `Normal`; si no hay, el de precio más alto. (4) `JustTcgNoMatchError` se propaga sin capturar. (5) El precio NM no nulo queda registrado en `price_cache` tras la llamada. (6) La función `fetchCardPrice` existente no ha sido modificada. | T-01 | — | Feature: §5.5, RN-05, RN-06; Global: `tech-stack.md` §JustTCG |
| T-03 | Tests unitarios de `fetchCardConditionPrices` | Completada | Ampliar `src/services/justtcg-client.test.ts` con los siguientes casos: (a) respuesta con variants para las 5 condiciones → retorna los 5 precios correctamente; (b) una condición sin variants → `priceUsd: null` para esa condición; (c) condición con variant Normal y otro Holo → elige Normal; (d) condición sin variant Normal → elige el de precio más alto; (e) `JustTcgNoMatchError` → se propaga; (f) NM no nulo → se llama a `upsertPriceCache` con el precio correcto; (g) NM nulo → `upsertPriceCache` no se llama. Mockear el cliente JustTCG y `upsertPriceCache`. | `src/services/justtcg-client.test.ts`, datos de fixtures de variantes JustTCG | Tests añadidos en `justtcg-client.test.ts`, todos en verde. | (1) Los 7 casos descritos están cubiertos. (2) No hay llamadas reales a la red en ningún test. (3) `vitest run` pasa sin errores ni warnings de la función. | T-02 | — | Feature: §5.5, RN-05, RN-06; Plan: T-03 |

---

### Fase 2 — Capa de datos de detalle de carta

**Objetivo:** Crear las funciones de acceso a datos necesarias para la pantalla: metadata de carta+set, copias del usuario e integración multi-plataforma (SQLite en native, localStorage en web).

| ID | Tarea | Estado | Descripción | Inputs | Entregable | Criterio de aceptación | Dependencias | Owner | Spec origen |
|---|---|---|---|---|---|---|---|---|---|
| T-04 | `getCardWithSetById` en repositorio de catálogo | Completada | Añadir función `getCardWithSetById(cardId: string)` en `src/db/repositories/catalog-repository.ts`. Ejecuta `SELECT cards.*, sets.name AS setName FROM cards JOIN sets ON cards.set_id = sets.id WHERE cards.id = ?`. Retorna un objeto con los campos de `cards` más `setName: string`, o `null` si no existe la carta. | `src/db/repositories/catalog-repository.ts`, `src/db/schema.ts` (tablas `cardsTable`, `setsTable`) | Función `getCardWithSetById` exportada. Compila sin errores. | (1) Retorna el objeto completo (id, setId, number, name, imageUrl, setName) para un `cardId` existente. (2) Retorna `null` para un `cardId` inexistente. (3) El campo `setName` proviene de la tabla `sets`, no de `cards`. | — | — | Feature: §4.3; Global: `tech-stack.md` §DB |
| T-05 | `getInventoryCopiesByCardId` en repositorio de inventario | Completada | Añadir función `getInventoryCopiesByCardId(cardId: string)` en `src/db/repositories/inventory-repository.ts`. Ejecuta SELECT con JOINs sobre `inventory`, `collections`, `cards`, y `price_cache` filtrado por `inventory.card_id = cardId`. Retorna un array de objetos con: `inventoryId`, `collectionId`, `collectionName`, `quantity`, `condition`, `priceUsd`, `priceTimestamp`. El array puede estar vacío si el usuario no posee la carta. | `src/db/repositories/inventory-repository.ts`, `src/db/schema.ts` | Función `getInventoryCopiesByCardId` exportada. | (1) Retorna todas las entradas del usuario para ese `cardId`, en todas las colecciones. (2) Cada entrada incluye `collectionName` (nunca `null`, usar fallback `"Sin colección"` si el JOIN no resuelve). (3) El array está vacío si no hay entradas. (4) Los campos `priceUsd` y `priceTimestamp` pueden ser `null`. | — | — | Feature: §4.2, RN-03; Global: `tech-stack.md` §DB |
| T-06 | Servicio `catalog-card-detail.ts` multi-plataforma | Completada | Crear `src/services/catalog-card-detail.ts` con dos funciones exportadas: (A) `getCatalogCardMetadata(cardId: string)`: en native llama a `getCardWithSetById`; en web itera las claves `tcg:catalog:cards:set:v2:*` en localStorage para localizar la carta por su `id`. Retorna `{ id, name, number, setId, setName, imageUrl } \| null`. (B) `getCopiesForCard(cardId: string)`: en native llama a `getInventoryCopiesByCardId`; en web itera las entradas del `tcg:inventory:items:v2` filtradas por `cardId` y enriquece con `collectionName` desde `tcg:collections:v1`. Retorna `MyCardCopiesSummary` con `copies[]` y `totalQuantity` (suma de `quantity`). El tipo `MyCardCopiesSummary` se define en `src/services/types.ts` si aún no existe. Usar el patrón de inyección de dependencias (deps default + override) establecido en servicios existentes. | `src/db/repositories/catalog-repository.ts` (T-04), `src/db/repositories/inventory-repository.ts` (T-05), `src/services/web-storage.ts`, `catalog-card-detail-spec.md` §4.2, §4.3 | `src/services/catalog-card-detail.ts` con las dos funciones exportadas. | (1) En native: metadata correcta para `cardId` existente; `null` para inexistente. (2) En web: localiza la carta iterando claves de set; `null` si no se encuentra. (3) `getCopiesForCard` retorna `totalQuantity = 0` y `copies = []` si el usuario no tiene la carta. (4) `totalQuantity` es la suma correcta de `quantity` de todos los `copies`. (5) `collectionName` está siempre presente en cada copia (web y native). | T-04, T-05, T-01 (tipos) | — | Feature: §4.2, §4.3, §5.2; Global: `tech-stack.md` |
| T-07 | Tests unitarios del servicio `catalog-card-detail.ts` | Completada | Crear `src/services/catalog-card-detail.test.ts` con los siguientes casos: (a) native — metadata para cardId existente retorna campos correctos; (b) native — cardId inexistente retorna `null`; (c) native — copias en múltiples colecciones calcula `totalQuantity` correctamente; (d) native — carta sin copias retorna `copies = []` y `totalQuantity = 0`; (e) web — metadata localiza carta en localStorage; (f) web — carta inexistente en localStorage retorna `null`; (g) web — copias enriquecidas con `collectionName` desde `tcg:collections:v1`. Usar mocks de `Platform.OS` y de las funciones repositorio (inyección de deps). | `src/services/catalog-card-detail.ts` (T-06) | `catalog-card-detail.test.ts` con todos los casos en verde. | (1) Los 7 casos están cubiertos. (2) No hay I/O real de SQLite ni localStorage en ningún test. (3) `vitest run` pasa sin errores. | T-06 | — | Feature: §4.2, §4.3; Plan: T-07 |

---

### Fase 3 — Pantalla `/card/[cardId]`

**Objetivo:** Crear la nueva pantalla de detalle de catálogo con sus tres secciones (metadata, precios por condición, "Mis copias") y el comportamiento offline completo.

| ID | Tarea | Estado | Descripción | Inputs | Entregable | Criterio de aceptación | Dependencias | Owner | Spec origen |
|---|---|---|---|---|---|---|---|---|---|
| T-08 | Registrar la ruta `card/[cardId]` en el layout principal | Completada | En `app/_layout.tsx`: añadir `<Stack.Screen name="card/[cardId]" options={{ title: "Detalle carta" }} />` dentro del `<Stack>`. Crear el directorio `app/card/` (puede quedar vacío hasta T-09). | `app/_layout.tsx` | `_layout.tsx` con la nueva ruta registrada. Directorio `app/card/` creado. | (1) La aplicación compila sin errores tras el cambio. (2) Una llamada a `router.push('/card/test-id')` desde cualquier pantalla no produce error de ruta no encontrada (puede mostrar pantalla en blanco hasta T-09). | — | — | Feature: §2 (ruta nueva); Global: `tech-stack.md` §Expo Router |
| T-09 | Pantalla principal `app/card/[cardId].tsx` | Completada | Crear `app/card/[cardId].tsx`. Estructura: (1) Extraer `cardId` de `useLocalSearchParams`. (2) Tres queries TanStack Query en paralelo: `queryKey: ["catalog-card-metadata", cardId]` → `getCatalogCardMetadata`; `queryKey: ["inventory-copies", cardId]` → `getCopiesForCard`; `queryKey: ["card-condition-prices", cardId]` → `fetchCardConditionPrices`, con `staleTime` de `Number(process.env.EXPO_PUBLIC_PRICES_STALE_TIME_MS ?? "3600000")`. (3) UI: header con imagen grande (o placeholder), nombre, número de carta, nombre de set; (4) Sección "Precios por condición": tabla de 5 filas `[condición] [precio USD]` con estado de carga (skeleton o texto "Cargando...") mientras `pricesQuery.isLoading`; (5) Sección "Mis copias": lista de `MyCardCopy` si `copies.length > 0`, o texto "No tienes esta carta en ninguna colección." si vacío; cada entrada es `<Pressable onPress={() => router.push(\`/inventory/${copy.inventoryId}\`)}>`; (6) Botón "Agregar a colección" visible siempre (conectado en T-13); (7) Si `metadataQuery.data === null` (carta no encontrada en catálogo): mostrar mensaje de error con botón "Volver". | `src/services/catalog-card-detail.ts` (T-06), `src/services/justtcg-client.ts` `fetchCardConditionPrices` (T-02), T-08 | `app/card/[cardId].tsx` funcional. | (1) CA-02: la imagen, nombre, número y set se muestran sin esperar precios (metadata independiente). (2) CA-03: con conexión, la tabla muestra los 5 estados de condición con precio USD. (3) CA-06: la sección "Mis copias" lista todas las entradas. (4) CA-07: pulsar una copia navega a `/inventory/[inventoryId]`. (5) Si metadata es `null`, se muestra error con navegación de vuelta. | T-06, T-02, T-08 | — | Feature: §5.1, §5.2, CA-01–CA-07; RN-01, RN-07 |
| T-10 | Comportamiento offline en la sección de precios | Completada | En `app/card/[cardId].tsx`: leer `isOffline` desde `useAppStore`. Cuando `isOffline = true`: (1) Añadir `enabled: !isOffline` a la query de precios para que no se lance; (2) Cargar `price_cache` para el `cardId` actual con una query separada `queryKey: ["price-cache", cardId]` → `getPriceCache(cardId)` (importar de `price-cache-repository`); (3) Construir un `CardConditionPrices` sintético con `source = "cache_nm_only"`: NM con el precio del caché (o `null` si vacío), las otras 4 condiciones con `priceUsd: null`; (4) Mostrar en la sección de precios: banner "Sin conexión – mostrando último precio NM conocido" encima de la tabla; si `price_cache` vacío → "Sin precio conocido" en lugar del precio NM. Cuando `isOffline = false`, el comportamiento de T-09 aplica normalmente. | `app/card/[cardId].tsx` (T-09), `src/db/repositories/price-cache-repository.ts`, `src/store/app-store.ts` | Comportamiento offline correcto en la sección de precios. | (1) CA-04: offline muestra NM del caché; las 4 condiciones restantes muestran "No disponible". (2) CA-04: si `price_cache` vacío → "Sin precio conocido". (3) Con `isOffline = true`, no se realiza ninguna llamada de red a JustTCG. (4) Metadata y "Mis copias" siguen visibles offline (sus queries no dependen de conexión). | T-09 | — | Feature: §5.2 paso 3, RN-04, CA-04; Global: `tech-stack.md` §offline |
| T-11 | Manejo de error de precios con reintento | Completada | En `app/card/[cardId].tsx`: (1) Cuando `pricesQuery.isError` y la causa es `JustTcgNoMatchError`, mostrar en la sección de precios: "Precio no disponible para esta carta" (sin botón de reintento). (2) Cuando `pricesQuery.isError` por cualquier otro error (red, timeout, etc.), mostrar: mensaje de error genérico "No se pudieron cargar los precios" + botón "Reintentar" que llama a `pricesQuery.refetch()`. En ambos casos, el resto de la pantalla (metadata, "Mis copias", botón de alta) permanece visible y funcional. Detectar `JustTcgNoMatchError` comprobando `pricesQuery.error instanceof JustTcgNoMatchError` o por nombre (`error.name === "JustTcgNoMatchError"`). | `app/card/[cardId].tsx` (T-09), `src/services/justtcg-client.ts` (`JustTcgNoMatchError`) | Estados de error diferenciados en la sección de precios. | (1) CA-05: `JustTcgNoMatchError` muestra "Precio no disponible" sin romper la pantalla y sin botón de reintento. (2) Otros errores muestran el botón "Reintentar" que lanza `refetch()`. (3) Metadata y "Mis copias" no se ocultan en ningún estado de error de precios. | T-09 | — | Feature: §5.2 edge cases, §5.5 edge cases, CA-05 |

---

### Fase 4 — Modal "Agregar a colección"

**Objetivo:** Crear el componente `AddCardModal` reutilizable y conectarlo al botón de la pantalla de detalle para permitir el alta inline sin salir de la pantalla.

| ID | Tarea | Estado | Descripción | Inputs | Entregable | Criterio de aceptación | Dependencias | Owner | Spec origen |
|---|---|---|---|---|---|---|---|---|---|
| T-12 | Crear componente `AddCardModal` | Completada | Crear `src/components/add-card-modal.tsx`. Props: `visible: boolean`, `cardId: string`, `cardName: string`, `onClose: () => void`. Internamente: (1) Query `getCollectionsSummary()` para cargar las colecciones disponibles; (2) Estado: `selectedCollectionId`, `quantityInput` (string), `condition` (CardCondition, default `"Near Mint"`), `formError`; (3) En el primer render (o cuando `visible` cambia a `true`), preseleccionar la primera colección disponible; (4) Botón "Confirmar": validar que la cantidad es un entero positivo, llamar a `addCardToInventory` con `{ cardId, collectionId, quantity, condition, ... }` usando `useMutation`; al confirmar exitosamente: invalidar `["inventory-copies", cardId]` en `useQueryClient` y llamar a `onClose()`; (5) Botón "Cancelar": llama a `onClose()` sin cambios; (6) Error de formulario: mostrar `formError` si la mutation falla; (7) Usar el componente `Modal` de React Native con `animationType="slide"`. El modal NO llama a `navigation.navigate` ni a `router.push`. | `src/services/inventory-upsert.ts` (`addCardToInventory`), `src/services/collection-management.ts` (`getCollectionsSummary`), `src/constants/card-condition.ts`, `catalog-card-detail-spec.md` §5.3, S-06 | `src/components/add-card-modal.tsx` exportado y compilando. | (1) La carta queda registrada en inventario con los parámetros correctos tras confirmar. (2) La query `["inventory-copies", cardId]` se invalida automáticamente tras el alta. (3) Al cancelar, el estado del formulario se resetea y no hay cambios en inventario. (4) Si la mutation falla, se muestra el error sin cerrar el modal. (5) El modal nunca navega a `/add-card`. (6) La sección "Mis copias" muestra la nueva entrada al volver al foco de la pantalla. | T-06 (tipos `MyCardCopy`), T-09 (queryKey `["inventory-copies"]`) | — | Feature: §5.3, RN-08, CA-08, D-04 (S-06) |
| T-13 | Integrar `AddCardModal` en la pantalla de detalle | Completada | En `app/card/[cardId].tsx`: (1) Añadir estado `const [isAddModalOpen, setIsAddModalOpen] = useState(false)`; (2) Renderizar `<AddCardModal visible={isAddModalOpen} cardId={cardId} cardName={metadata?.name ?? ""} onClose={() => setIsAddModalOpen(false)} />`; (3) Vincular el botón "Agregar a colección" a `onPress={() => setIsAddModalOpen(true)}`; (4) El botón debe estar visible siempre, independent de si el usuario ya posee la carta (RN-08). | `app/card/[cardId].tsx` (T-09), `src/components/add-card-modal.tsx` (T-12) | Modal funcional e integrado en la pantalla. | (1) CA-08: pulsar "Agregar a colección" abre el modal con la carta pre-identificada. (2) Al confirmar en el modal, éste se cierra y la sección "Mis copias" se actualiza. (3) El botón "Agregar a colección" está visible tanto si el usuario posee la carta como si no. (4) La pantalla no navega a ninguna otra ruta al usar el modal. | T-09, T-12 | — | Feature: §5.3, RN-08, CA-08 |
| T-14 | Tests unitarios del componente `AddCardModal` | Completada | Crear o ampliar tests para `src/components/add-card-modal.tsx`: (a) renderiza con los campos vacíos correctos al abrirse; (b) la colección por defecto es la primera de la query; (c) al pulsar "Confirmar" con datos válidos, se llama a `addCardToInventory` con los parámetros correctos; (d) después de una confirmación exitosa, se llama a `onClose`; (e) si `addCardToInventory` falla, se muestra el error sin llamar a `onClose`; (f) al pulsar "Cancelar", se llama a `onClose` sin llamar a `addCardToInventory`; (g) cantidad no numérica o <= 0 genera error de validación sin llamar al servicio. Mockear `addCardToInventory`, `getCollectionsSummary` y `useQueryClient`. | `src/components/add-card-modal.tsx` (T-12) | Tests en verde para el componente modal. | (1) Los 7 casos están cubiertos. (2) No hay llamadas reales a SQLite, localStorage ni red. (3) `vitest run` pasa sin errores. | T-12 | — | Feature: §5.3, CA-08; Plan: T-14 |

---

### Fase 5 — Modificación del explorador de sets

**Objetivo:** Hacer toda carta pulsable hacia `/card/[cardId]` y convertir el badge de inventario en indicador visual sin acción de navegación.

| ID | Tarea | Estado | Descripción | Inputs | Entregable | Criterio de aceptación | Dependencias | Owner | Spec origen |
|---|---|---|---|---|---|---|---|---|---|
| T-15 | Hacer cada carta pulsable en `sets/[setId].tsx` | Completada | En `app/sets/[setId].tsx`, en el bloque `(cardsQuery.data ?? []).map(card => ...)`: (1) Importar `useRouter` si no está ya importado; (2) Envolver el `<View key={card.id} ...>` actual de cada carta en un `<Pressable onPress={() => router.push(\`/card/${card.id}\`)} accessibilityRole="button" accessibilityLabel={`Ver detalle de ${card.name}`}>`. Asegurarse de que el `key` se mueve al `Pressable`. (3) No eliminar ningún contenido interno actual de la card. | `app/sets/[setId].tsx`, `catalog-card-detail-spec.md` §5.1, RN-07 | `sets/[setId].tsx` modificado con cada carta envuelta en `Pressable`. | (1) CA-01: pulsar cualquier carta (poseída o no) navega a `/card/[cardId]`. (2) Las cartas no poseídas son ahora navegables (antes no lo eran). (3) El aspecto visual de las cards no cambia (solo se añade el wrapper). (4) La pantalla no introduce errores de compilación ni runtime. | T-08 (ruta registrada) | — | Feature: §5.1, RN-07, CA-01 |
| T-16 | Convertir badge "En inventario" en indicador visual puro | Completada | En `app/sets/[setId].tsx`, dentro del bloque de `card.isOwned`: el badge actual `"En inventario · {card.ownedQuantity}"` debe ser un `<View>` estático con el texto, sin ningún `onPress` ni `Pressable` envolvente. Verificar que no hay ningún listener de evento apuntando a `/inventory/[inventoryId]` desde esta pantalla. La cantidad mostrada (`card.ownedQuantity`) representa el total de copias en todas las colecciones, ya calculado por `getCatalogSetCardsWithOwnership`. | `app/sets/[setId].tsx` (T-15), `src/services/catalog-explorer.ts` (`CatalogCardWithOwnership.ownedQuantity`) | Badge estático sin comportamiento de navegación. | (1) CA-09: el badge "En inventario · N" muestra la cantidad correcta y no actúa como enlace al inventario. (2) No existe ningún `onPress` en el badge tras este cambio. (3) La navegación al detalle de inventario solo ocurre desde "Mis copias" en `/card/[cardId]`. | T-15 | — | Feature: §5.1 paso 4, CA-09 |

---

### Fase 6 — Calidad y accesibilidad

**Objetivo:** Cobertura de tests de integración del flujo completo, roles de accesibilidad declarados y validación final de todos los criterios de aceptación (CA-01 a CA-10).

| ID | Tarea | Estado | Descripción | Inputs | Entregable | Criterio de aceptación | Dependencias | Owner | Spec origen |
|---|---|---|---|---|---|---|---|---|---|
| T-17 | Test de integración del flujo de detalle de catálogo | Completada | En `src/integration/catalog-flow.test.ts` (ampliar el existente o crear si no existe): cubrir el flujo completo — (a) set sincronizado localmente → navegar a `/card/[cardId]` → metadata visible; (b) precios por condición disponibles con mock de JustTCG que retorna 5 variantes → tabla correcta; (c) copias del usuario presentes → sección "Mis copias" con datos correctos; (d) "Agregar a colección" en modal → carta queda en inventario → "Mis copias" actualizado. Usar mocks de la capa de red para JustTCG. OJO: los tests de integración siguen el patrón de los existentes en `src/integration/` (sin render de UI, solo capa de servicios). | Pantalla T-09, modal T-13, servicios T-02, T-06 finalizados. Fichero `src/integration/catalog-flow.test.ts`. | Test de integración en verde. | (1) CA-02, CA-03, CA-06, CA-08 verificados por los tests. (2) No hay llamadas reales a JustTCG ni a la base de datos nativa. (3) `vitest run` pasa sin errores en el fichero. | T-09, T-13 | — | Feature: CA-02, CA-03, CA-06, CA-08; Global: `tech-stack.md` §Testing |
| T-18 | Añadir roles de accesibilidad en la pantalla de detalle | Completada | En `app/card/[cardId].tsx`: (1) Cada fila de precio (`[condición] [precio]`): añadir `accessibilityRole="text"` y `accessibilityLabel` con condición y precio (ej. `"Near Mint: $3.50"`). (2) Cada entrada de "Mis copias": el `<Pressable>` ya tiene `onPress`, añadir `accessibilityRole="button"` y `accessibilityLabel` descriptivo (ej. `"Ver entrada de inventario, colección Mi colección, 2 copias NM"`). (3) El botón "Agregar a colección": `accessibilityRole="button"` y `accessibilityLabel="Agregar carta a una colección"`. (4) Verificar navegación por tabulación en web (Expo Router soporta esto de forma nativa en web; asegurarse de que los `Pressable` reciben focus). | `app/card/[cardId].tsx` (T-09) tras las fases 3 y 4 completas. | Roles y etiquetas de accesibilidad añadidos en la pantalla. | (1) NFR de accesibilidad de `catalog-card-detail-spec.md` §7 satisfecho. (2) Cada elemento interactivo tiene `accessibilityRole` declarado. (3) Los `accessibilityLabel` son descriptivos y no están vacíos. | T-09, T-13 | — | Feature: §7 (NFR accesibilidad) |
| T-19 | Validación final de criterios de aceptación CA-01 a CA-10 | Completada | Revisar manualmente (o mediante test automatizado cuando sea posible) cada uno de los 10 criterios de aceptación definidos en `catalog-card-detail-spec.md` §8. Para cada CA: indicar si está cubierto por un test automatizado, por verificación manual o por ambos. Especial atención a: CA-04 (offline NM), CA-05 (JustTcgNoMatchError), CA-10 (NM persiste en `price_cache`). Documentar en comentario en el propio fichero de spec cualquier desviación encontrada. | Todas las tareas de Fases 1–5 completas. `catalog-card-detail-spec.md` §8. | Checklist de CAs con estado de cada uno (`✓ Automatizado`, `✓ Manual`, `✗ Pendiente`). | (1) Los 10 CAs tienen estado `✓`. (2) Cero CAs en estado `✗` para cerrar la feature. (3) Cualquier desviación está documentada en la spec. | T-10, T-11, T-15, T-16, T-17, T-18 | — | Feature: §8 (CA-01 a CA-10) |

---

## Ruta crítica reflejada

Las siguientes tareas forman la ruta crítica. Un retraso en cualquiera de ellas retrasa la entrega de la feature:

| Posición | Tarea | Bloquea a |
|---|---|---|
| 1 | **T-01** — Tipos `ConditionPriceEntry` / `CardConditionPrices` | T-02, T-06 |
| 2 | **T-02** — `fetchCardConditionPrices` | T-09 |
| 3 | **T-04** + **T-05** *(en paralelo)* — Repositorios native | T-06 |
| 4 | **T-06** — Servicio `catalog-card-detail.ts` | T-09, T-12 |
| 5 | **T-08** — Registro de ruta | T-09 |
| 6 | **T-09** — Pantalla principal | T-10, T-11, T-13, T-15, T-17, T-18 |
| 7 | **T-12** — Componente `AddCardModal` | T-13 |
| 8 | **T-13** — Integración del modal | T-14, T-17 |

Las fases 5 (T-15, T-16) y 6 (T-17, T-18, T-19) pueden iniciarse en paralelo entre sí una vez T-09 esté completado.

---

## Riesgos trasladados a ejecución

Tareas que deben mitigar explícitamente los riesgos identificados en el plan de implementación:

| Riesgo | Tarea responsable | Acción de mitigación |
|---|---|---|
| JustTCG no retorna variantes para las 5 condiciones | **T-03** | Los tests deben incluir un fixture real (o semi-real) que valide qué condiciones retorna la API. Si solo retorna NM/LP, las demás aparecerán con `priceUsd: null` — comportamiento correcto por spec; ajustar los assertions de T-03 si se prueba con datos reales. |
| Latencia de búsqueda por `cardId` en web iterando localStorage | **T-06** | Medir el tiempo de `getCatalogCardMetadata` en web con un set grande (≥200 cartas) durante el desarrollo. Si es > 200ms observable, añadir un índice en memoria (Map) en Zustand o en el propio servicio como optimización local. |
| Acoplamiento del formulario de alta con `add-card.tsx` | **T-12** | Crear `AddCardModal` desde cero. No copiar JSX de `add-card.tsx`. Reutilizar únicamente `addCardToInventory` y `getCollectionsSummary`. |
| `EXPO_PUBLIC_PRICES_STALE_TIME_MS` ausente en build | **T-02** | Asegurar que el fallback `?? "3600000"` está en el código y que la variable está en `.env.example`. Verificar en T-19 que la app funciona sin la variable definida. |
| Detección de `isOffline` difiere entre web y native | **T-10** | Usar exclusivamente `useAppStore(state => state.isOffline)`. Verificar en T-19 que el hook `useNetworkState` está montado en el layout raíz antes de que se cargue la pantalla de detalle. |

---

## Siguiente bloque recomendado

Las primeras tareas a ejecutar son las que arrancan la ruta crítica y pueden paralelizarse:

| Prioridad | Tarea | Motivo |
|---|---|---|
| 1 | **T-01** — Tipos de dominio | Bloquea T-02 y T-06. Es la tarea más pequeña y de menor riesgo. Se puede completar en < 30 minutos. |
| 2a *(paralela)* | **T-02** — `fetchCardConditionPrices` | Habilita la pantalla de precios. Iniciar inmediatamente después de T-01. Hacer una llamada de prueba real a JustTCG para validar S-01 (cobertura de condiciones). |
| 2b *(paralela)* | **T-04** + **T-05** — Repositorios SQLite | Independientes entre sí y de T-02. Tiempo reducido (~1h cada una). |
| 3 | **T-08** — Registro de ruta | Sin dependencias. Puede ejecutarse en minutos y desbloquea la creación de la pantalla. |
| 4 | **T-06** — Servicio multi-plataforma | Unifica los repositorios y habilita tanto T-09 como T-12. |
