# Plan de Implementación — Múltiples Colecciones

## Resumen del plan

Extensión del MVP para introducir colecciones independientes de inventario. El usuario puede crear, renombrar y eliminar colecciones; agregar la misma carta en varias colecciones y con distintas condiciones en la misma colección; y mover entradas entre colecciones. La pantalla raíz `app/index.tsx` se transforma en el listado de colecciones.

El plan se divide en 4 fases: modelo de datos y repositorios, servicios de dominio, pantallas y navegación, y calidad. Estimación total:

| Estimación | Total |
|---|---|
| Desarrollador humano | **63 horas (~8 días laborables)** |
| Desarrollador + IA (Copilot/Agent) | **24 horas (~3 días laborables)** |

---

## Áreas grises resueltas

| Área gris | Tipo | Resolución |
|---|---|---|
| Modelo UNIQUE de inventario | Bloqueante | `UNIQUE(cardId, collectionId, condition)` — confirmado por el usuario. Una carta puede estar NM y LP en la misma colección como entradas separadas. |
| Colección "por defecto" / inicial | Bloqueante | No existe flag especial. La app auto-crea "Mi colección" en el primer arranque si no hay ninguna. Es una colección ordinaria, renombrable y eliminable. |
| Eliminación de colección con cartas | Bloqueante | Obligatorio seleccionar colección destino antes de confirmar. No se puede eliminar directamente. Resuelto por el usuario. |
| Orden del listado de colecciones | Bloqueante | Por defecto: fecha de creación ASC. Opciones: nombre, nº de cartas, valor total; cada una en ASC/DESC. Resuelto por el usuario. |
| Comportamiento del refresco de precio | Importante | Ahora es por entrada específica de inventario, no por `cardId` global. Cambia el contrato de `updateInventoryPriceSnapshotByCardId`. Confirmado por el usuario (S-04 de spec). |
| Back-navigation desde detalle de inventario | Menor | Se asume `router.back()` — Expo Router gestiona la pila. No requiere `collectionId` en la URL de `/inventory/[inventoryId]`. |
| Paso de `collectionId` a `add-card` | Menor | Via query param en la URL: `/add-card?collectionId=xyz`. Consistente con el patrón de Expo Router del proyecto. |
| Persistencia del estado de ordenación | Menor | No se persiste entre sesiones. Resetea a fecha de creación ASC al recargar la app. |
| Nombre "Mi colección" | Menor | Hardcodeado en el código de inicialización. No tiene significado especial en lógica de negocio posterior — el `id` es la referencia. |
| SQLite: añadir NOT NULL con FK a tabla existente | Técnico | SQLite no soporta `ALTER TABLE ADD COLUMN NOT NULL` en tablas con datos. La migración requiere: (1) crear tabla `collections` con la colección inicial, (2) añadir `collection_id` como nullable, (3) `UPDATE inventory SET collection_id = <id_inicial>`, (4) recrear la tabla con la constraint NOT NULL mediante el patrón rename+recreate de SQLite/Drizzle. |

---

## Mapa de fuentes

| Requisito / Decisión | Spec origen | Tipo | Estado |
|---|---|---|---|
| Tabla `collections` sin `isDefault` | `multi-collections-spec.md` §4.1 | Feature | Confirmado |
| UNIQUE(cardId, collectionId, condition) | `multi-collections-spec.md` §4.2 | Feature | Confirmado |
| Web localStorage `v1 → v2` | `multi-collections-spec.md` §4.3, §5.5 | Feature | Confirmado |
| Tipo `CollectionSummary` | `multi-collections-spec.md` §4.4 | Feature | Confirmado |
| Listado de colecciones como pantalla raíz | `multi-collections-spec.md` D-02 (resuelto) | Feature | Confirmado |
| Orden del listado: fecha, nombre, cartas, valor | `multi-collections-spec.md` D-01 (resuelto), §5.1 | Feature | Confirmado |
| Flujo crear colección | `multi-collections-spec.md` §5.2 | Feature | Confirmado |
| Flujo ver cartas de colección | `multi-collections-spec.md` §5.3 | Feature | Confirmado |
| Flujo agregar carta con selector de colección | `multi-collections-spec.md` §5.4 | Feature | Confirmado |
| Flujo migración web v1 → v2 | `multi-collections-spec.md` §5.5 | Feature | Confirmado |
| Flujo mover carta entre colecciones | `multi-collections-spec.md` §5.6 | Feature | Confirmado |
| Flujo renombrar colección | `multi-collections-spec.md` §5.7 | Feature | Confirmado |
| Flujo eliminar colección + selector destino | `multi-collections-spec.md` §5.8, D-04 (resuelto) | Feature | Confirmado |
| Precio de mercado por `(cardId, condition)`, no propagado | `multi-collections-spec.md` RN-06, S-04 | Feature | Confirmado |
| Indicador de posesión global en explorador de sets | `multi-collections-spec.md` RN-12 | Feature | Confirmado |
| Stack Drizzle + expo-sqlite + localStorage dual | `specs/tech-stack.md` | Global | Confirmado |
| Flujo de alta original | `specs/MVP/mvp-spec.md` §3.2 | Global | Adaptado |
| Flujo de inventario original | `specs/MVP/mvp-spec.md` §3.1 | Global | Adaptado |

---

## Plan por fases

### Fase 1 — Modelo de datos y repositorios

**Objetivo:** Extender el esquema SQLite y el localStorage con la tabla `collections` y el nuevo campo `collectionId` en `inventory`, incluyendo la lógica de migración de datos y los repositorios CRUD necesarios.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 1.1 | Migración SQLite: tabla `collections` | Crear el fichero de migración Drizzle (`0001_collections.sql`) con: (1) `CREATE TABLE collections`, (2) `INSERT` de la colección inicial "Mi colección", (3) añadir `collection_id` nullable a `inventory`, (4) `UPDATE inventory` con el id inicial, (5) recrear `inventory` con `collection_id NOT NULL`, FK y `UNIQUE(card_id, collection_id, condition)`. Actualizar `schema.ts` con `collectionsTable` y los cambios en `inventoryTable`. | Migración SQL + schema Drizzle actualizado | La migración aplica correctamente sobre una BD vacía y sobre una BD existente con datos; el esquema refleja la nueva estructura; la antigua `UNIQUE(card_id)` implícita desaparece. | — | 5h | 2h |
| 1.2 | Repositorio de colecciones (nativo) | Crear `src/db/repositories/collections-repository.ts` con: `getAllCollections()`, `getCollectionById(id)`, `insertCollection(row)`, `updateCollectionName(id, name)`, `deleteCollection(id)`, `collectionExists(id)`, `getCollectionsCount()`. Tipado desde `collectionsTable.$inferSelect`. | `collections-repository.ts` | Las operaciones CRUD funcionan; `getCollectionsCount()` retorna el número correcto; `deleteCollection` lanza error si quedaría 0 colecciones (guard en repo). | 1.1 | 3h | 1h |
| 1.3 | Actualizar repositorio de inventario (nativo) | En `inventory-repository.ts`: añadir `collectionId` a todos los `select`, `insert` y `update`. Añadir `getInventoryItemByCardIdAndCollectionIdAndCondition(cardId, collectionId, condition)`. Renombrar / adaptar `getInventoryItemByCardId` para que filtre también por `collectionId`. Actualizar `saveInventoryItem` para incluir `collectionId`. Cambiar `updateInventoryPriceSnapshotByCardId` a `updateInventoryPriceSnapshot(inventoryId, priceUsd, timestamp)` (solo la entrada específica). Añadir `getInventoryItemsByCollectionId(collectionId)` y `reassignInventoryItems(fromCollectionId, toCollectionId)`. | `inventory-repository.ts` actualizado | Todas las queries incluyen `collectionId`; el lookup de duplicados usa la tripleta `(cardId, collectionId, condition)`; la actualización de precio es por `inventoryId`; `reassignInventoryItems` mueve todas las entradas respetando la UNIQUE constraint mediante merge cuando colisiona. | 1.1 | 5h | 2h |
| 1.4 | Repositorio de colecciones (web localStorage) | En `inventory-query.ts` o nuevo fichero dedicado: funciones de lectura/escritura de `tcg:collections:v1` (`readWebCollections`, `writeWebCollections`, `findWebCollectionById`, `getWebCollectionsCount`). Adaptar las funciones existentes de `tcg:inventory:items:v2` para incluir `collectionId` en las operaciones de lectura/escritura web. | Helpers de localStorage para colecciones v1 + inventario v2 | Los helpers leen/escriben correctamente la nueva clave `v2`; incluyen `collectionId` en cada entrada; son seguros ante localStorage vacío o malformado. | — | 3h | 1h |

**Subtotal Fase 1:** Humano **16h** | Humano+IA **6h**

---

### Fase 2 — Servicios de dominio

**Objetivo:** Implementar los servicios de negocio para gestión de colecciones, adaptación del upsert de inventario a la nueva UNIQUE constraint, consultas con `CollectionSummary`, operación de mover cartas y nuevo comportamiento de refresco de precio.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 2.1 | Servicio de gestión de colecciones | Crear `src/services/collection-management.ts` con: `getCollectionsSummary(sortBy, sortDir)` — lee todas las colecciones con sus métricas (totalCardsCount, totalUniqueCardsCount, totalCollectionValueUsd); `createCollection(name)` — valida nombre (no vacío, ≤50 chars, no duplicado) y persiste; `renameCollection(id, newName)` — mismas validaciones; `deleteCollection(id, targetCollectionId)` — reasigna entradas a `targetCollectionId` con merge y elimina; `ensureAtLeastOneCollection()` — crea "Mi colección" si no existe ninguna. Implementación dual nativo/web. | `collection-management.ts` | `getCollectionsSummary` retorna métricas correctas para cada colección y ordena adecuadamente; `createCollection` rechaza nombre duplicado case-insensitive; `deleteCollection` falla si solo queda una colección; la reasignación de entradas fusiona correctamente cuando `(cardId, targetCollection, condition)` ya existe. | 1.2, 1.3, 1.4 | 6h | 2.5h |
| 2.2 | Actualizar `inventory-upsert` | En `addCardToInventory`: añadir `collectionId` como parámetro requerido. Cambiar la lógica de lookup de duplicado de `getInventoryItemByCardId` a `getInventoryItemByCardIdAndCollectionIdAndCondition`. Actualizar la ruta web para usar `tcg:inventory:items:v2` e incluir `collectionId` en el objeto serializado. Actualizar el tipo `AddCardInput`. | `inventory-upsert.ts` actualizado | Agregar la misma carta con distinta condición en la misma colección crea dos entradas separadas; agregar la misma carta con la misma condición en la misma colección suma cantidad; agregar la misma carta en distintas colecciones crea entradas independientes. | 1.3, 1.4 | 3h | 1h |
| 2.3 | Actualizar `inventory-query` | Añadir `getCollectionInventoryOverview(collectionId)` — versión filtrada de `getInventoryOverview` para una colección. Actualizar `getInventoryOverview` para aceptar `collectionId` opcional (si se pasa, filtra; si no, devuelve todo — útil para el badge global del explorador). Actualizar la web path para leer de `tcg:inventory:items:v2`. | `inventory-query.ts` actualizado | `getCollectionInventoryOverview` solo retorna entradas de la colección indicada; el valor total es el de esa colección; la versión sin `collectionId` sigue funcionando para el explorador de sets. | 1.3, 1.4 | 3h | 1h |
| 2.4 | Actualizar `inventory-detail` y precio | En `inventory-detail.ts`: añadir operación `moveInventoryEntry(inventoryId, targetCollectionId)` — llama al servicio de reasignación para una entrada individual. Actualizar `refreshInventoryCardPrice` para que use `updateInventoryPriceSnapshot(inventoryId, ...)` en lugar de `updateInventoryPriceSnapshotByCardId`. Actualizar la función de refresco en la web path con la misma semántica de `inventoryId`-specific. | `inventory-detail.ts` actualizado | Mover una entrada la transfiere a la colección destino con merge si colisiona; el refresco de precio actualiza solo la entrada indicada, no todas las entradas de ese `cardId`; los tests existentes de refresco de precio pasan tras actualizar sus expectativas. | 1.3, 2.1 | 4h | 1.5h |
| 2.5 | Actualizar `catalog-explorer` | En `getCatalogSetCardsWithOwnership`: la detección de `isOwned` y `ownedQuantity` debe sumar las cantidades a través de TODAS las colecciones (comportamiento global). Actualizar la query join o la lógica de agregación para que no dependa de un solo `inventoryId` sino del total. Adaptar el tipo `CatalogCardWithOwnership`: `inventoryId` pasa a ser `inventoryIds: string[]` o se elimina (la navigación al detalle individual se hace desde `/card/[cardId]` en la futura feature de catálogo). | `catalog-explorer.ts` actualizado | El badge "En inventario" en el explorador de sets muestra la suma de `quantity` de todas las colecciones para esa carta; si la carta está en dos colecciones con 2 y 3 copias, muestra 5; el campo `isOwned` es `true` si existe en cualquier colección. | 1.3, 2.3 | 3h | 1h |

**Subtotal Fase 2:** Humano **19h** | Humano+IA **7h**

---

### Fase 3 — Pantallas y navegación

**Objetivo:** Transformar `app/index.tsx` en el listado de colecciones, crear la pantalla de cartas por colección, actualizar el formulario de alta y el detalle de inventario, y ajustar el explorador de sets.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 3.1 | Actualizar `app/_layout.tsx` | Registrar las nuevas rutas: `collections/[collectionId]` con título dinámico. Renombrar el `Stack.Screen` de `index` a "Mis colecciones". Asegurar que todas las rutas existentes (`add-card`, `sets/index`, `sets/[setId]`, `inventory/[inventoryId]`) siguen registradas. | `_layout.tsx` actualizado | La app navega sin errores de router; las nuevas rutas resuelven; el título de la pantalla raíz muestra "Mis colecciones". | — | 1h | 0.5h |
| 3.2 | Transformar `app/index.tsx` en listado de colecciones | Reescribir la pantalla para mostrar: lista de `CollectionSummary`, controles de ordenación (4 criterios × ASC/DESC), botón "Nueva colección" que abre modal inline de creación, menú contextual por colección (renombrar / eliminar), modal de confirmación de eliminación (variante vacía y variante con selector de destino), modal de renombrado con validación inline. Cada colección navega a `/collections/[collectionId]`. El estado de ordenación se gestiona con `useState` local (no persiste). | `index.tsx` transformado | El listado muestra las colecciones con nombre, nº de cartas únicas y valor total; la ordenación funciona en los 8 modos; crear una colección la añade al listado; eliminar una colección con cartas exige seleccionar destino y reasigna correctamente; eliminar la última colección no es posible. | 2.1 | 6h | 2.5h |
| 3.3 | Nueva pantalla `app/collections/[collectionId].tsx` | Crear la pantalla de cartas de una colección. Reutiliza la lógica existente de `app/index.tsx` (antes de la transformación): listado de entradas de inventario de la colección, buscador por nombre, filtro por set, métricas de la colección (total cartas y valor). El botón "Agregar carta" lleva a `/add-card?collectionId=[collectionId]`. Cada carta navega a `/inventory/[inventoryId]`. | `collections/[collectionId].tsx` | El usuario ve solo las cartas de la colección seleccionada; buscar y filtrar funciona scoped a esa colección; las métricas son las de esa colección únicamente; estado vacío con CTA funcional. | 2.3, 3.1 | 5h | 2h |
| 3.4 | Actualizar `app/add-card.tsx` | Añadir lectura del query param `collectionId`. Si llega, pre-selecciona esa colección en el selector. Si no llega, pre-selecciona la colección más antigua. Añadir el selector de colección al formulario de alta (por encima de cantidad y condición): list of `CollectionSummary` con radio/selector. Pasar `collectionId` al `addCardToInventory`. Actualizar la navegación de retorno para usar `router.back()` (funciona correctamente tanto si viene de `/collections/[id]` como de `/`). | `add-card.tsx` actualizado | Al acceder desde `/collections/[id]`, la colección aparece pre-seleccionada; al acceder desde el inicio, se selecciona la más antigua; cambiar la selección antes de guardar persiste en la colección correcta; la carta se fusiona si ya existe `(cardId, collectionId, condition)`. | 2.1, 2.2 | 4h | 1.5h |
| 3.5 | Actualizar `app/inventory/[inventoryId].tsx` | Añadir botón "Mover a colección" visible solo cuando existen ≥ 2 colecciones. Al pulsar: dropdown/modal con colecciones disponibles (excluye la colección actual de la entrada). Al seleccionar destino: llama a `moveInventoryEntry`; si hay colisión, muestra aviso de merge con confirmación. Actualizar el call a `refreshInventoryCardPrice` para que use la nueva semántica by-inventoryId. | `inventory/[inventoryId].tsx` actualizado | El botón "Mover" solo aparece con ≥ 2 colecciones; mover una carta la transfiere correctamente; si hay colisión, el usuario debe confirmar el merge; tras mover, el usuario vuelve a la pantalla anterior (colección origen, ahora sin la carta). | 2.4, 3.1 | 4h | 1.5h |
| 3.6 | Actualizar `app/sets/[setId].tsx` | Actualizar el badge "En inventario · N" para mostrar la cantidad total sumada de todas las colecciones. Eliminar `inventoryId` como destino de navegación del badge (ahora solo es indicador visual). La fila de cada carta puede hacerse pulsable hacia `/card/[cardId]` si la feature de detalle de catálogo está implementada; si no, el badge sigue siendo un indicador visual no navegable. | `sets/[setId].tsx` actualizado | El badge muestra la suma correcta de todas las colecciones; no intenta navegar a un único `inventoryId` cuando hay múltiples entradas; si la carta no está en ninguna colección, muestra "No la tienes". | 2.5 | 2h | 0.5h |

**Subtotal Fase 3:** Humano **22h** | Humano+IA **8.5h**

---

### Fase 4 — Migración web, tests y calidad

**Objetivo:** Implementar el bootstrap de migración de localStorage, actualizar todos los tests existentes que dependen del modelo de inventario sin `collectionId`, y añadir cobertura de los nuevos flujos.

| # | Tarea | Descripción | Entregable | Criterio de aceptación | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 4.1 | Bootstrap de migración web (localStorage v1 → v2) | Crear `src/services/collections-bootstrap.ts` con la función `bootstrapCollections()`: detecta `tcg:collections:v1`; si no existe, crea la colección inicial y escribe en `v1`; detecta `tcg:inventory:items:v1`; si existe y `v2` no existe: crea `v2` con el `collectionId` de la colección inicial para cada entrada, luego marca `v1` como migrado (clave `tcg:inventory:migration:done`). Llamar a esta función en el bootstrap de `app-providers.tsx` antes de cualquier query. | `collections-bootstrap.ts` + integración en providers | Tras migración: `v2` contiene todas las entradas de `v1` con `collectionId`; `v1` sigue intacto (o marcado); si `v2` ya existía antes de `v1`, no se vuelve a migrar; si la migración falla a mitad, se puede reintentar sin duplicar datos. | 1.4 | 3h | 1h |
| 4.2 | Actualizar tests unitarios existentes | Actualizar todos los tests que crean entradas de inventario sin `collectionId`: `inventory-flow.test.ts`, `catalog-flow.test.ts`, `explorer-flow.test.ts`, `offline-flow.test.ts`, `inventory-query.test.ts`, `inventory-upsert.test.ts`, `inventory-detail.test.ts`, `price-variation.test.ts`. Añadir un `collectionId` válido a todos los seeds y mocks. Actualizar expectativas de `updateInventoryPriceSnapshotByCardId` → `updateInventoryPriceSnapshot(inventoryId)`. Actualizar la clave `tcg:inventory:items:v1` → `v2` en los tests que lean/escriban localStorage. | Todos los tests existentes pasan en verde | `npm test` pasa sin errores; ningún test usa `v1` para escribir datos de inventario (salvo el propio test de migración); los tests de price-variation reflejan que el precio se actualiza por `inventoryId`, no por `cardId`. | 1.1-1.4, 2.1-2.5 | 4h | 1.5h |
| 4.3 | Tests unitarios de gestión de colecciones | Tests para `collection-management.ts`: (1) `getCollectionsSummary` — métricas correctas, ordenación por los 4 criterios en ambas direcciones; (2) `createCollection` — nombre duplicado case-insensitive rechazado, nombre vacío rechazado, nombre >50 chars rechazado, creación exitosa; (3) `renameCollection` — mismas validaciones; (4) `deleteCollection` — rechaza eliminar la última, reasigna con merge correcto, elimina con colección vacía; (5) `ensureAtLeastOneCollection` — crea colección si no existe, no hace nada si ya existe. | Tests unitarios de `collection-management.ts` | Cobertura de todos los casos nominales y de borde de RN-01 a RN-12 de la spec; los tests usan mocks de repositorios, no acceden a BD real. | 2.1 | 4h | 1.5h |
| 4.4 | Tests de integración: flujos de colecciones | Nuevos tests de integración en `src/integration/collections-flow.test.ts`: (1) Crear colección y agregar carta a ella; (2) Agregar la misma carta con distinta condición en la misma colección — dos entradas separadas; (3) Agregar la misma carta + misma condición dos veces — merge de cantidad; (4) Mover carta a otra colección — sin colisión; (5) Mover carta a colección donde ya existe esa combinación — merge; (6) Eliminar colección vacía; (7) Eliminar colección con cartas — reasignación a destino elegido; (8) Valor total de colección calculado correctamente. | `collections-flow.test.ts` | Todos los flujos principales de la spec pasan; los tests usan localStorage mock (patrón de los tests existentes); no dependen de APIs externas. | 2.1-2.5, 4.1 | 4h | 1.5h |
| 4.5 | Tests de la migración web | Tests para `collections-bootstrap.ts`: (1) Primer arranque sin datos — crea `v1` con colección inicial; (2) `v1` existe con datos — crea `v2` con `collectionId` asignado, conserva `v1`; (3) Migración ya realizada (marca presente) — no modifica `v2`; (4) `v2` ya existe sin `v1` — no hace nada; (5) `v1` vacío — crea `v2` vacío. | Tests unitarios de `collections-bootstrap.ts` | Los 5 escenarios pasan; la migración es idempotente (ejecutarla dos veces produce el mismo resultado); los datos de `v1` nunca se corrompen ni se pierden. | 4.1 | 2h | 0.5h |

**Subtotal Fase 4:** Humano **17h** | Humano+IA **6h**

---

## Ruta crítica

Las siguientes tareas bloquean a otras y deben completarse en orden:

1. **1.1** — Migración SQLite y schema: base de todo el modelo de datos nativo
2. **1.3** — Repositorio de inventario actualizado: prerequisito de todos los servicios
3. **1.4** — Helpers web localStorage v2: prerequisito de servicios en web
4. **2.1** — Servicio de gestión de colecciones: prerequisito de pantallas de gestión
5. **2.2** — `inventory-upsert` actualizado: prerequisito de la pantalla de alta
6. **2.3** — `inventory-query` actualizado: prerequisito de pantalla de colección y listado
7. **3.2** — `index.tsx` transformado: pantalla principal new experience
8. **3.3** — `collections/[collectionId].tsx`: pantalla de cartas por colección
9. **4.2** — Tests existentes actualizados: asegura que nada está roto antes de cerrar

**Paralelas seguras:** 1.2 puede iniciarse en paralelo con 1.3. 4.3, 4.4 y 4.5 pueden ejecutarse en paralelo una vez terminada la fase 2.

---

## Registro de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Migración SQLite en tabla con datos existentes: `ALTER TABLE ADD COLUMN NOT NULL` falla en SQLite sin recrear la tabla | Alta | Alto | Usar el patrón de migración en 5 pasos documentado en §Áreas grises resueltas. Validar la migración con datos reales antes de integrar. Drizzle puede generar la SQL automáticamente si se configura correctamente; si no, escribir la migración manualmente. |
| `updateInventoryPriceSnapshotByCardId` es llamado en múltiples sitios del código | Media | Medio | Renombrar la función y pasar `inventoryId`; TypeScript marcará todos los puntos de uso como error de compilación, facilitando la búsqueda exhaustiva. Cubrir con tests antes de cambiar (`4.2` primero). |
| Tests existentes fallando masivamente por `collectionId` ausente en seeds | Alta | Bajo | El impacto es controlado: los tests se conocen, son finitos y el patrón de fix es uniforme (añadir `collectionId` a cada seed). IA acelera este trabajo significativamente. |
| Migración web `v1 → v2` en producción con localStorage con datos reales o corruptos | Baja | Alto | La migración preserva `v1` intacto como fallback. Test de idempotencia (`4.5`) cubre los escenarios de datos malformados. |
| `catalog-explorer` ownership query se vuelve lenta con muchas colecciones | Baja | Bajo | La cantidad de colecciones es acotada (decenas como máximo). Si la query es un JOIN sobre inventario, el índice existente en `inventory.card_id` es suficiente. Añadir índice en `inventory.collection_id` si se detecta lentitud. |
| Conflicto de nombres entre `tcg:collections:v1` y alguna clave futura de otra feature | Muy baja | Bajo | El espacio de nombres `tcg:collections:` está libre ahora. Documentar la clave en `tech-stack.md` durante el cierre de la feature. |

---

## Resumen de estimaciones

| Fase | Descripción | Humano | Humano+IA |
|---|---|---:|---:|
| Fase 1 | Modelo de datos y repositorios | 16h | 6h |
| Fase 2 | Servicios de dominio | 19h | 7h |
| Fase 3 | Pantallas y navegación | 22h | 8.5h |
| Fase 4 | Migración web, tests y calidad | 17h | 6h |
| **TOTAL** | | **74h (~9.5 días)** | **27.5h (~3.5 días)** |

> **Nota sobre aceleración con IA:** El mayor ahorro ocurre en (1) generación de tipos Drizzle y queries SQL, (2) reescritura de tests existentes para añadir `collectionId` a todos los seeds, (3) scaffolding de nuevas pantallas reutilizando patrones existentes, y (4) servicios CRUD con dual path nativo/web. La detección de colisiones y lógica de merge en la migración SQLite requiere atención manual — la IA ayuda pero no elimina el tiempo de razonamiento.

---

## Próximos pasos

1. **Empezar por 1.1** — Escribir la migración SQL `0001_collections.sql` y actualizar `schema.ts`. Validar que Drizzle genera correctamente el patrón de recreación de tabla para SQLite. Este paso es el cuello de botella de toda la fase 1 y desbloquea el resto.

2. **Continuar con 1.2 + 1.3 + 1.4 en paralelo** — Una vez el schema está validado, los tres repositorios son independientes entre sí y pueden desarrollarse en paralelo o en secuencia rápida con ayuda de IA.

3. **Ejecutar `npm test` después de cada tarea de fase 2** — El cambio de contrato de `updateInventoryPriceSnapshotByCardId` y la clave de localStorage `v1 → v2` romperán tests existentes. Detectarlo pronto —tarea 4.2— evita acumular deuda de tests al final.
