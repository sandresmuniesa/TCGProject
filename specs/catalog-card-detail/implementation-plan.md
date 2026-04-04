# Plan de Implementación — Detalle de Carta desde Catálogo

## Resumen del plan

Nueva pantalla `/card/[cardId]` que permite consultar el detalle completo de cualquier carta del catálogo —poseída o no— mostrando precios JustTCG por condición, sección "Mis copias" y botón de alta rápida mediante modal. Incluye la modificación del explorador de sets para hacer toda carta navegable.

El plan se divide en **6 fases**: servicio de precios por condición, capa de datos de catálogo, pantalla principal, modal de alta, modificación del explorador y calidad.

| Estimación | Total |
|---|---|
| Desarrollador humano | **37 horas (~4,5 días laborables)** |
| Desarrollador + IA (Copilot/Agent) | **13 horas (~1,5 días laborables)** |

---

## Áreas grises resueltas

Todas las decisiones de la spec estaban formalmente abiertas (D-01 a D-04) y han sido resueltas por el usuario antes de la planificación. Las áreas grises técnicas se resuelven como suposiciones confirmadas en diseño.

| Área gris | Tipo | Resolución |
|---|---|---|
| Acceso al detalle desde listado de colección | D-01 (Bloqueante) | **No** — la lista de colección navega siempre al detalle de inventario. Confirmado. |
| `staleTime` para precios por condición | D-02 (Importante) | **1 hora por defecto**, configurable vía `EXPO_PUBLIC_PRICES_STALE_TIME_MS`. Confirmado. |
| Destacar condición del usuario en tabla de precios | D-03 (Menor) | **No** — todas las condiciones con igual peso visual. Confirmado. |
| Flujo "Agregar a colección" desde detalle | D-04 (Bloqueante) | **Modal inline en `/card/[cardId]`**, no navega a `/add-card`. Confirmado. |
| Búsqueda de carta por `cardId` en web (localStorage) | Técnico | En web, los cards se almacenan por set (`tcg:catalog:cards:set:v2:{setId}`). No existe índice por `cardId`. Resolución: iterar todos los sets en localStorage para encontrar la carta. Rendimiento aceptable dado que los sets ya están cacheados en memoria por TanStack Query. |
| Nombre de variable de entorno para `staleTime` | Técnico | Se usa el prefijo Expo estándar: `EXPO_PUBLIC_PRICES_STALE_TIME_MS`. Parseado como entero; fallback a `3600000` (1h). |
| Extracción del formulario de alta a modal | Técnico | `add-card.tsx` no es un componente genérico reutilizable. Se crea un componente `AddCardModal` independiente en `src/components/` con los campos esenciales: colección, cantidad, condición. Reutiliza `addCardToInventory` service. |
| Función de precios multi-condición en JustTCG | Técnico | Nueva función `fetchCardConditionPrices` en `justtcg-client.ts`. Llama con `condition: ["NM","LP","MP","HP","DMG"]`, reutiliza `pickBestCard` existente, y aplica nueva lógica de agrupación por condición (RN-05). Sin modificar `fetchCardPrice` existente. |

---

## Mapa de fuentes

| Requisito / Decisión | Spec origen | Tipo | Estado |
|---|---|---|---|
| Pantalla `/card/[cardId]` | `catalog-card-detail-spec.md` §2, §5.2 | Feature | Confirmado |
| Tipo `CardConditionPrices` | `catalog-card-detail-spec.md` §4.1 | Feature | Confirmado |
| Tipo `MyCardCopiesSummary` | `catalog-card-detail-spec.md` §4.2 | Feature | Confirmado |
| Precios NM/LP/MP/HP/DMG via JustTCG bajo demanda | §5.5, RN-02 | Feature | Confirmado |
| Regla de variante por condición (Normal/mayor precio) | §5.5 paso 4, RN-05 | Feature | Confirmado |
| Persistir NM en `price_cache` | §5.5 paso 6, RN-06 | Feature | Confirmado |
| `staleTime` = `EXPO_PUBLIC_PRICES_STALE_TIME_MS` (default 1h) | §7, D-02 resuelto, S-07 | Feature | Confirmado |
| Sección "Mis copias": todas las colecciones | §5.2, RN-03 | Feature | Confirmado |
| Offline: solo precio NM del `price_cache` | §5.2, RN-04, CA-04 | Feature | Confirmado |
| Offline: banner contextual en sección precios | §5.2 paso 3 | Feature | Confirmado |
| JustTcgNoMatchError → mensaje sin bloqueo | §5.5, CA-05 | Feature | Confirmado |
| Modal "Agregar a colección" inline | §5.3, D-04 resuelto, S-06 | Feature | Confirmado |
| Explorador de sets: toda carta pulsable → `/card/[cardId]` | §5.1, RN-07, CA-01 | Feature | Confirmado |
| Badge "En inventario" solo visual (no enlace) | §5.1 paso 4, CA-09 | Feature | Confirmado |
| Todas las condiciones con igual peso visual | D-03 resuelto, S-05 | Feature | Confirmado |
| Sin acceso a catálogo desde listado de colección | D-01 resuelto, S-03 | Feature | Confirmado |
| Modelo de datos `cards`, `inventory`, `price_cache` | `tech-stack.md` §DB, `mvp-spec.md` §2 | Global | Confirmado |
| Multi-plataforma web/native | `tech-stack.md` | Global | Confirmado |
| TanStack Query para cache de API | `tech-stack.md` | Global | Confirmado |

---

## Plan por fases

### Fase 1 — Servicio de precios por condición

**Objetivo:** Extender `justtcg-client.ts` con una función que obtenga los precios de las 5 condiciones en una sola llamada y los mapee al tipo del dominio.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---|---|
| T-01 | Nuevos tipos de dominio | Añadir `ConditionPriceEntry` y `CardConditionPrices` a `src/services/types.ts` | Tipos exportados y compilando | Los tipos coinciden con §4.1 de la spec | — | 0,5h | 0,25h |
| T-02 | `fetchCardConditionPrices` | Nueva función en `justtcg-client.ts`: solicita las 5 condiciones, reutiliza `pickBestCard`, agrupa variants por condición aplicando RN-05 (Normal primero; si no, el de precio más alto), devuelve `CardConditionPrices`. Persiste NM en `price_cache` (reutiliza `upsertPriceCache`). | Función exportada | Con conexión retorna los 5 precios; variante sin precio retorna `null`; JustTcgNoMatchError se propaga; NM se guarda en caché | T-01 | 3h | 1h |
| T-03 | Tests de T-02 | Tests unitarios con mocks de JustTCG: éxito con 5 condiciones, condición sin variante, múltiples variantes (elige Normal), sin match (`JustTcgNoMatchError`), persistencia de NM | `justtcg-client.test.ts` ampliado | Cobertura de los 5 edge cases | T-02 | 2h | 0,75h |

**Subtotal Fase 1:** Humano **5,5h** · Humano+IA **2h**

---

### Fase 2 — Capa de datos de detalle de carta

**Objetivo:** Crear las funciones de acceso a datos necesarias para la pantalla: metadata de carta+set, copias del usuario e integración multi-plataforma.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---|---|
| T-04 | `getCardWithSetById` (native) | Nueva función en `src/db/repositories/catalog-repository.ts`: `SELECT cards.*, sets.name AS setName FROM cards JOIN sets ON cards.set_id = sets.id WHERE cards.id = ?` | Función exportada | Retorna `null` si no existe; retorna nombre de set correctamente | — | 1h | 0,5h |
| T-05 | `getInventoryCopiesByCardId` (native) | Nueva función en `src/db/repositories/inventory-repository.ts`: SELECT de `inventory JOIN collections JOIN cards JOIN price_cache` filtrado por `cardId`. Retorna array compatible con `MyCardCopy[]`. | Función exportada | Lista todas las entradas del usuario para ese `cardId` en todas las colecciones | — | 1,5h | 0,5h |
| T-06 | Servicio `catalog-card-detail.ts` | Nuevo servicio `src/services/catalog-card-detail.ts` con dos funciones: (1) `getCatalogCardMetadata(cardId)` — web+native, obtiene nombre, número, set, imageUrl; (2) `getCopiesForCard(cardId)` — web+native, agrega `MyCardCopy[]` con suma de `totalQuantity`. En web, itera `tcg:catalog:cards:set:v2:*` keys del localStorage para localizar la carta por ID. | Servicio exportado | Funciona en web (localStorage) y native (SQLite); retorna `null` si `cardId` no existe | T-04, T-05 | 3h | 1h |
| T-07 | Tests de T-06 | Tests unitarios de `getCatalogCardMetadata` y `getCopiesForCard`: metadata correcta, copias en múltiples colecciones, cardId inexistente, comportamiento web vs native (mocks de plataforma) | `catalog-card-detail.test.ts` | Cobertura de los casos principales | T-06 | 2h | 0,75h |

**Subtotal Fase 2:** Humano **7,5h** · Humano+IA **2,75h**

---

### Fase 3 — Pantalla `/card/[cardId]`

**Objetivo:** Crear la nueva pantalla de detalle de catálogo con sus tres secciones y el comportamiento offline.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---|---|
| T-08 | Registrar ruta en `_layout.tsx` | Añadir `<Stack.Screen name="card/[cardId]" options={{ title: "Detalle carta" }} />` en `app/_layout.tsx`. Crear directorio `app/card/`. | Ruta compilando | La pantalla es accesible vía `router.push('/card/xxx')` sin error | — | 0,5h | 0,25h |
| T-09 | Pantalla principal `app/card/[cardId].tsx` | Estructura de la pantalla con TanStack Query: (1) query metadata de catálogo (`getCatalogCardMetadata`) — sin `enabled` guard, se muestra de inmediato; (2) query copias (`getCopiesForCard`); (3) query precios por condición (`fetchCardConditionPrices`, `staleTime = EXPO_PUBLIC_PRICES_STALE_TIME_MS`). UI: header con imagen grande + nombre + número + set; sección precios (tabla 5 filas condición/precio); sección "Mis copias" (lista o empty state); botón "Agregar a colección". Manejo de cardId no encontrado (error + back). | `app/card/[cardId].tsx` | CA-01, CA-02, CA-03, CA-06, CA-07 satisfechos; imagen carga sin esperar precios | T-06, T-02, T-08 | 6h | 2h |
| T-10 | Comportamiento offline en pantalla | Cuando `isOffline` (Zustand store): (1) deshabilitar `fetchCardConditionPrices` query; (2) llamar a `getPriceCache(cardId)` para obtener NM; (3) renderizar banner "Sin conexión – mostrando último precio NM conocido"; (4) tabla de precios muestra solo NM con el valor del caché y las demás con "No disponible"; (5) si `price_cache` vacío: "Sin precio conocido". | Comportamiento offline en pantalla | CA-04 satisfecho; el resto de la pantalla sigue funcional offline | T-09 | 1,5h | 0,5h |
| T-11 | Error de carga de precios con reintento | Cuando la query de precios falla con conexión activa: mostrar mensaje de error en la sección de precios con botón "Reintentar" que llama a `refetch()`. `JustTcgNoMatchError` muestra "Precio no disponible para esta carta" (sin botón de reintento). | Estado de error en sección precios | CA-05 satisfecho; los demás datos de pantalla no se bloquean | T-09 | 1h | 0,5h |

**Subtotal Fase 3:** Humano **9h** · Humano+IA **3,25h**

---

### Fase 4 — Modal "Agregar a colección"

**Objetivo:** Crear el componente `AddCardModal` y conectarlo al botón de la pantalla de detalle.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---|---|
| T-12 | Componente `AddCardModal` | Nuevo componente `src/components/add-card-modal.tsx`. Recibe `cardId`, `cardName`, `onClose`. Campos: selector de colección (usa `getCollectionsSummary`), cantidad (input numérico), condición (selector). Botón "Confirmar" llama a `addCardToInventory` con los datos. Al confirmar: cierra modal + invalida query `["inventory-copies", cardId]`. Botón "Cancelar": cierra sin cambios. Usa el componente `Modal` nativo de React Native. | `src/components/add-card-modal.tsx` | La carta queda en inventario tras confirmar; la sección "Mis copias" se actualiza; no navega a `/add-card` | T-06 | 3h | 1h |
| T-13 | Integración del modal en la pantalla | En `app/card/[cardId].tsx`: añadir estado `isAddModalOpen`, renderizar `<AddCardModal>` condicionalmente, vincular el botón "Agregar a colección" a `setIsAddModalOpen(true)`. | Modal funcional en pantalla | CA-08 satisfecho; modal se abre y cierra correctamente; "Mis copias" se refresca | T-09, T-12 | 1h | 0,25h |
| T-14 | Tests del modal | Tests unitarios de `AddCardModal`: campos iniciales correctos, llamada a `addCardToInventory` con parámetros correctos, cierre tras confirmación, invalidación de query, cancelación sin efecto. | Tests en `src/components/` o integración | Cobertura de los casos principales | T-12 | 2h | 0,75h |

**Subtotal Fase 4:** Humano **6h** · Humano+IA **2h**

---

### Fase 5 — Modificación del explorador de sets

**Objetivo:** Hacer toda carta pulsable en `app/sets/[setId].tsx` y convertir el badge en indicador visual sin navegación.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---|---|
| T-15 | Cada carta es pulsable | Envolver el `<View key={card.id}>` de cada carta del mapa en `<Pressable onPress={() => router.push(\`/card/${card.id}\`)} accessibilityRole="button">`. Importar `useRouter` si no está importado. | `sets/[setId].tsx` modificado | CA-01 satisfecho: pulsar cualquier carta (poseída o no) navega a `/card/[cardId]` | T-08 | 1h | 0,25h |
| T-16 | Badge "En inventario" solo visual | Convertir el badge `"En inventario · N"` de elemento interactivo a `<View>` estático. Verificar que no tiene `onPress` ni `Pressable` envolvente. La cantidad mostrada es `card.ownedQuantity` (suma ya calculada por `getCatalogSetCardsWithOwnership`). | Badge no navegable | CA-09 satisfecho: badge visible pero sin acción de navegación al inventario | T-15 | 0,5h | 0,25h |

**Subtotal Fase 5:** Humano **1,5h** · Humano+IA **0,5h**

---

### Fase 6 — Calidad y accesibilidad

**Objetivo:** Cobertura de tests de integración, accesibilidad y validación de criterios de aceptación.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---|---|
| T-17 | Test de integración del flujo de detalle | Ampliar o crear `src/integration/catalog-flow.test.ts`: flujo completo — sincronizar set, navegar a carta, verificar metadata, precios, copias, modal de alta. Mock de JustTCG y red. | Test de integración verde | CA-02, CA-03, CA-06, CA-08 verificados en test | T-09, T-13 | 3h | 1h |
| T-18 | Accesibilidad de filas de precios y copias | Añadir `accessibilityRole="text"` o `"listitem"` en filas de precio y `accessibilityRole="button"` en cada entrada de "Mis copias". Verificar navegación por teclado en web. | Roles accesibles en la pantalla | NFR de accesibilidad de §7 satisfecho | T-09 | 1h | 0,5h |
| T-19 | Validación de CAs restantes | Revisión manual/test de CA-04 (offline NM), CA-05 (no match), CA-07 (navegación a inventario), CA-09 (badge), CA-10 (NM en cache). Documentar cualquier desviación. | Checklist de CAs validado | CA-01 a CA-10 todos satisfechos | T-10, T-11, T-15, T-16 | 1,5h | 0,5h |

**Subtotal Fase 6:** Humano **5,5h** · Humano+IA **2h**

---

## Ruta crítica

Las siguientes tareas bloquean al resto y deben completarse en orden:

1. **T-01** — Tipos base (bloquea T-02, T-06)
2. **T-02** — `fetchCardConditionPrices` (bloquea T-09)
3. **T-04 + T-05** *(paralelas)* — Repositorios native (bloquean T-06)
4. **T-06** — Servicio `catalog-card-detail.ts` (bloquea T-09, T-12)
5. **T-08** — Registro de ruta (bloquea T-09)
6. **T-09** — Pantalla principal (bloquea T-10, T-11, T-13, T-15, T-17, T-18)
7. **T-12** — Componente `AddCardModal` (bloquea T-13)
8. **T-13** — Integración del modal (bloquea T-14, T-17)

Las fases 5 y 6 pueden iniciarse en paralelo con la fase 4 una vez que T-09 esté completo.

```
T-01 ──► T-02 ──────────────────────────────────────────┐
T-04 ─┐                                                  ▼
T-05 ─┴──► T-06 ──► T-08 ──► T-09 ──► T-10, T-11       T-09
T-03 (test) ─── en paralelo                  │            │
T-07 (test) ─── en paralelo                  ├──► T-15 ──► T-16
                                              │
                                              ▼
                                       T-12 ──► T-13 ──► T-14
                                                    │
                                                    ▼
                                               T-17, T-18, T-19
```

---

## Registro de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| JustTCG no retorna variantes para las 5 condiciones (S-01: validación empírica pendiente) | Media | Alto | Verificar con llamada real en T-03. Si solo retorna NM/LP, mostrar las demás como "No disponible" — comportamiento ya cubierto en spec (§5.2 edge case). |
| Búsqueda de carta por ID en web (iterar localStorage) tiene latencia notable con muchos sets cacheados | Baja | Medio | Medir en T-06. Si resulta lento (>200ms observable), añadir índice en memoria (Map) en el store de Zustand. No bloquea la entrega. |
| Extracción del formulario a `AddCardModal` más compleja de lo esperado por acoplamiento con `add-card.tsx` | Media | Medio | Crear el modal desde cero reutilizando solo el servicio `addCardToInventory`. No reutilizar JSX de `add-card.tsx`. Estimado ya contempla esta complejidad. |
| `EXPO_PUBLIC_PRICES_STALE_TIME_MS` no disponible en algunos entornos de build | Baja | Bajo | El fallback a `3600000` es seguro. Añadir en `.env.example` y documentar en README. |
| Comportamiento offline difiere entre web y native en la detección de `isOffline` | Baja | Medio | Usar `useAppStore(state => state.isOffline)` que ya tiene listeners `online`/`offline` en web (ver `use-network-state.ts`). En native, revisar que el hook esté activo. No requiere trabajo adicional. |

---

## Resumen de estimaciones

| Fase | Descripción | Humano | Humano+IA | Aceleración IA |
|---|---|---|---|---|
| Fase 1 | Servicio precios por condición | 5,5h | 2h | Alta — lógica de mapeo y tests repetitivos |
| Fase 2 | Capa de datos de detalle | 7,5h | 2,75h | Alta — queries Drizzle, servicios multi-plataforma |
| Fase 3 | Pantalla `/card/[cardId]` | 9h | 3,25h | Alta — scaffold de pantalla, estados de carga/error |
| Fase 4 | Modal "Agregar a colección" | 6h | 2h | Alta — formulario repetitivo, tests de componente |
| Fase 5 | Modificación explorador de sets | 1,5h | 0,5h | Media — cambios quirúrgicos en pantalla existente |
| Fase 6 | Calidad y accesibilidad | 5,5h | 2h | Media — tests de integración, roles accesibles |
| **Total** | | **35h (~4,5 días)** | **12,5h (~1,5 días)** | **2,8×** |

---

## Próximos pasos

1. **Añadir tipos y `fetchCardConditionPrices`** (T-01 + T-02): abrir `src/services/types.ts` y `src/services/justtcg-client.ts`. Implementar la nueva función con llamada `condition: ["NM","LP","MP","HP","DMG"]`, agrupación por condición y persistencia de NM. Hacer una llamada de prueba manual para validar el supuesto S-01 (cobertura de variantes por condición en JustTCG).

2. **Crear `getCatalogCardMetadata` y `getCopiesForCard`** (T-04 + T-05 + T-06): añadir `getCardWithSetById` al repositorio de catálogo y `getInventoryCopiesByCardId` al de inventario; construir el servicio `src/services/catalog-card-detail.ts` con soporte web+native.

3. **Registrar ruta y crear pantalla base** (T-08 + T-09 inicio): añadir la entrada en `_layout.tsx`, crear `app/card/[cardId].tsx` con las tres queries paralelas (metadata, precios, copias) y el layout mínimo funcional antes de añadir estilos o lógica offline.
