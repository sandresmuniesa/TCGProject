# Feature Specification — Detalle de Carta desde Catálogo

---

## 1. Objetivo

Permitir al usuario consultar el detalle completo de cualquier carta del catálogo —tanto si la posee como si no— desde cualquier pantalla donde se listen cartas. El detalle muestra información del catálogo (imagen, nombre, número, set) y precios de JustTCG desglosados por condición. Si el usuario posee copias de esa carta en alguna de sus colecciones, se muestra una sección "Mis copias" con la distribución por colección, cantidad y condición, con acceso directo al detalle de inventario de cada entrada.

Esta feature elimina el punto ciego actual: las cartas no poseídas en el explorador de sets son elementos no navegables, impidiendo consultar precio o añadir la carta al inventario desde ese contexto.

---

## 2. Alcance

### Incluido
- Nueva pantalla `/card/[cardId]` de detalle de carta del catálogo.
- Precios por condición (NM, LP, MP, HP, Damaged) obtenidos de JustTCG.
- Sección "Mis copias": distribución de copias del usuario a través de todas sus colecciones.
- Navegación desde el explorador de sets a esta pantalla para cualquier carta (poseída o no).
- Botón "Agregar a colección" desde el detalle.
- Navegación desde "Mis copias" al detalle de inventario de cada entrada.
- Comportamiento offline: los precios por condición no están disponibles, se muestra el último precio NM conocido del `price_cache`.

### Excluido
- Modificación del detalle de inventario (`/inventory/[inventoryId]`): sigue existiendo sin cambios estructurales.
- Historial de precios a lo largo del tiempo (feature futura).
- Comparativa de precios entre condiciones con gráficos.
- Acceso a este detalle desde el inventario de colección (el listado de cartas de una colección navega al detalle de inventario; el catálogo navega al detalle de catálogo).
- Precios en caché persistido de JustTCG por condición (solo se persistirá el precio NM en el `price_cache` existente; los demás se obtienen en sesión).

### Dependencias con specs globales
- Modelo de datos `cards`, `inventory`, `price_cache` en `specs/MVP/mvp-spec.md` §2.
- Integración JustTCG y estrategia de matching `specs/tech-stack.md` §Integraciones externas.
- Feature multi-collections `specs/multi-collections/multi-collections-spec.md` — "Mis copias" muestra la colección de cada entrada; si esta feature se implanta antes que multi-collections, se puede mostrar simplemente la lista de copias sin colección.

---

## 3. Actores

| Actor | Descripción |
|---|---|
| Usuario coleccionista | Consulta detalle de cartas del catálogo, revisa precios por condición y comprueba sus copias. |
| JustTCG API | Fuente de precios por condición. Se consulta bajo demanda con los mismos parámetros de matching existentes. |

---

## 4. Estructura de datos

### 4.1 Tipo de respuesta para precios por condición

Este tipo no se persiste en SQLite. Se gestiona únicamente en memoria mediante TanStack Query.

```typescript
type ConditionPriceEntry = {
  condition: "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played" | "Damaged";
  priceUsd: number | null;
};

type CardConditionPrices = {
  cardId: string;            // ID de tcgdex
  prices: ConditionPriceEntry[];
  fetchedAt: Date;
  source: "remote" | "cache_nm_only";
  // source = "cache_nm_only" cuando offline: solo se puede mostrar el último NM del price_cache
};
```

### 4.2 Tipo para "Mis copias"

Derivado del modelo de inventario extendido con colecciones (ver `multi-collections-spec.md` §4).

```typescript
type MyCardCopy = {
  inventoryId: string;
  collectionId: string;
  collectionName: string;
  quantity: number;
  condition: CardCondition;
  priceUsd: number | null;       // precio guardado en inventario para esa entrada
  priceTimestamp: Date | null;
};

type MyCardCopiesSummary = {
  cardId: string;
  copies: MyCardCopy[];           // una entrada por (inventoryId) — puede haber varias en distintas colecciones
  totalQuantity: number;          // suma de quantity de todas las copies
};
```

**Nota de compatibilidad:** si la feature `multi-collections` aún no está implementada, `collectionId` y `collectionName` pueden omitirse o mostrar un valor por defecto ("Mi colección"). Una vez implementada, no existe una colección "por defecto" especial: se muestra el nombre real de cada colección.

### 4.3 Pantalla — datos necesarios

La pantalla `/card/[cardId]` requiere:
1. Metadata de catálogo: `cards JOIN sets` (disponible offline).
2. Precios por condición: llamada a JustTCG (requiere conexión).
3. Mis copias: consulta a `inventory` filtrado por `cardId` (disponible offline).

---

## 5. Flujos funcionales

### 5.1 Flujo: Acceder al detalle de carta desde el explorador de sets

**Trigger:** Usuario pulsa sobre cualquier carta en la pantalla `/sets/[setId]`.

**Precondiciones:** La carta existe en el catálogo local. El explorador de sets ha cargado el listado.

**Pasos:**
1. Actualmente, las cartas poseídas tienen un badge pulsable que navega a `/inventory/[inventoryId]`. Las no poseídas no son navegables. **Con esta feature, ambas situaciones cambian.**
2. Toda la fila/card de carta en el explorador de sets se vuelve pulsable.
3. Al pulsar, se navega a `/card/[cardId]`.
4. El badge "En inventario · N" sigue apareciendo como indicador visual, pero ya NO es el punto de navegación al inventario (esa navegación se realiza desde la sección "Mis copias" en el detalle).

**Postcondiciones:** El usuario está en el detalle de carta del catálogo.

**Error / edge cases:**
- `cardId` no encontrado en catálogo local: se muestra error con navegación de vuelta.

---

### 5.2 Flujo: Ver detalle de carta del catálogo

**Trigger:** Navegación a `/card/[cardId]` desde cualquier contexto.

**Precondiciones:** `cardId` corresponde a una carta en el catálogo local.

**Pasos:**
1. Se muestra inmediatamente la información del catálogo (disponible offline):
   - Imagen de la carta.
   - Nombre, número, nombre del set.
2. Se lanza en paralelo:
   - Consulta de precios por condición a JustTCG (si hay conexión).
   - Consulta de "Mis copias" al inventario local.
3. Sección de precios por condición:
   - Mientras carga: estado de carga por sección.
   - Si hay conexión y la llamada tiene éxito: tabla con las 5 condiciones y sus precios en USD. Si alguna condición no tiene precio disponible en JustTCG, se muestra "No disponible".
   - Si sin conexión: banner "Sin conexión – mostrando último precio NM conocido" y solo se muestra el último precio NM del `price_cache`.
   - Si la llamada falla con conexión: mensaje de error en la sección de precios con botón de reintento.
4. Sección "Mis copias":
   - Si el usuario tiene copias: lista de entradas con colección, cantidad y condición. Cada entrada es pulsable y navega a `/inventory/[inventoryId]`.
   - Si no tiene copias: mensaje "No tienes esta carta en ninguna colección."
5. Botón "Agregar a colección" visible siempre (incluso si ya se posee la carta).

**Postcondiciones:** El usuario ha visto el detalle completo de la carta con precios y sus copias actuales.

**Error / edge cases:**
- JustTCG no encuentra match para la carta (`JustTcgNoMatchError`): se muestra "Precio no disponible para esta carta" en la sección de precios. No es un error bloqueante.
- JustTCG devuelve datos parciales (solo algunas condiciones): se muestran los disponibles y "No disponible" en el resto.
- `price_cache` vacío y sin conexión: se muestra "Sin precio conocido" en la sección de precios.

**UI hints:**
- Imagen grande en la parte superior.
- Sección de precios: tabla o lista de filas `[condición] [precio]`. Resaltar visualmente la condición NM (precio de referencia de mercado).
- Sección "Mis copias": cards con colección, cantidad en badge, condición como texto. Cada card pulsable.
- Botón "Agregar a colección" en zona fija o al final del scroll.

---

### 5.3 Flujo: Agregar carta desde el detalle de catálogo

**Trigger:** Usuario pulsa "Agregar a colección" en `/card/[cardId]`.

**Precondiciones:** —

**Pasos:**
1. Se invoca el flujo de alta definido en `multi-collections-spec.md` §5.4, con la carta ya pre-seleccionada.
2. El usuario solo necesita seleccionar colección, cantidad y condición.
3. Al confirmar, se regresa al detalle de carta con la sección "Mis copias" actualizada.

**Postcondiciones:** La carta está en el inventario de la colección seleccionada.

---

### 5.4 Flujo: Navegar al detalle de inventario desde "Mis copias"

**Trigger:** Usuario pulsa una entrada en la sección "Mis copias" de `/card/[cardId]`.

**Pasos:**
1. Se navega a `/inventory/[inventoryId]` de esa entrada específica.
2. Desde ese detalle, el usuario puede editar cantidad, condición, refrescar precio o eliminar la entrada.
3. Al navegar de vuelta, la sección "Mis copias" se refresca.

**Postcondiciones:** El usuario ha accedido y potencialmente modificado una entrada de inventario concreta.

---

### 5.5 Flujo: Obtención de precios por condición desde JustTCG

**Trigger:** Carga de la pantalla `/card/[cardId]` con conexión disponible.

**Precondiciones:** Existe metadata de la carta en catálogo local (nombre, número, nombre de set).

**Pasos:**
1. Se llama a JustTCG con los mismos parámetros de matching actuales (`cardName`, `cardNumber`, `setName`), pero **sin filtrar por condición específica** (o solicitando todas las condiciones).
2. La respuesta incluye un objeto `Card` con array `variants`, cada uno con `condition` y `price`.
3. Se mapean los variants a las 5 condiciones del dominio:

   | JustTCG condition | Dominio |
   |---|---|
   | `NM` | Near Mint |
   | `LP` | Lightly Played |
   | `MP` | Moderately Played |
   | `HP` | Heavily Played |
   | `DMG` | Damaged |

4. Si hay múltiples variants para la misma condición (ej. Normal y Holo), se toma el de tipo `Normal` preferentemente; si no hay Normal, se toma el de precio más alto.
5. El resultado se devuelve como `CardConditionPrices` y se cachea en TanStack Query con `staleTime = 5 minutos`.
6. El precio NM (o el mejor disponible) se persiste en `price_cache` para mantener la coherencia con el modelo existente.

**Postcondiciones:** Los precios por condición están disponibles para mostrar en pantalla.

**Error / edge cases:**
- Ningún variant con precio disponible: `prices` array con todos los `priceUsd = null`.
- JustTCG no encuentra la carta: `JustTcgNoMatchError` propagado y capturado en la UI.
- Timeout / error de red: se captura silenciosamente en la sección de precios; no bloquea el resto de la pantalla.

---

## 6. Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | La pantalla de detalle de catálogo `/card/[cardId]` es accesible para cualquier carta del catálogo local, independientemente de si el usuario la posee. |
| RN-02 | Los precios por condición se obtienen siempre de JustTCG bajo demanda. No se persisten en SQLite por condición individual (solo el NM en `price_cache`). |
| RN-03 | La sección "Mis copias" muestra TODAS las entradas de inventario de esa carta en TODAS las colecciones del usuario. |
| RN-04 | Sin conexión, la sección de precios por condición muestra únicamente el último precio NM del `price_cache`. El resto de condiciones se muestran como "No disponible". |
| RN-05 | Si hay múltiples variants para una condición en JustTCG, se elige: primero el tipo Normal; si no hay, el de precio más alto. |
| RN-06 | El precio NM obtenido en el detalle de catálogo se persiste en `price_cache` para mantener coherencia con la variación de precio en el inventario. |
| RN-07 | La navegación desde el explorador de sets siempre va al detalle de catálogo (`/card/[cardId]`), no al detalle de inventario. El badge "En inventario" es un indicador visual, no un enlace al inventario. |
| RN-08 | El botón "Agregar a colección" está disponible incluso si el usuario ya posee la carta (puede agregar a otra colección o sumar cantidad). |
| RN-09 | El detalle de catálogo y el detalle de inventario (`/inventory/[inventoryId]`) son pantallas independientes con propósitos distintos: el primero es informativo/exploratorio, el segundo es de gestión de una entrada concreta. |

---

## 7. Requisitos no funcionales

- **Carga no bloqueante:** la metadata del catálogo (imagen, nombre, set) se muestra de forma inmediata desde SQLite local, sin esperar la respuesta de precios de JustTCG.
- **Degradación offline:** la pantalla es totalmente funcional offline excepto la sección de precios por condición, que muestra el último precio NM conocido.
- **Cache en sesión:** los precios por condición se cachean en TanStack Query con `staleTime = 5 minutos`. No se realiza una llamada a JustTCG en cada visita si el dato es reciente.
- **Accesibilidad:** cada fila de precio y cada entrada de "Mis copias" deben tener un rol accesible y ser navegables por teclado en web.
- Referencia a NFRs globales de MVP: rendimiento, soporte web/nativo y cobertura de tests definidos en `specs/MVP/mvp-spec.md` §4.

---

## 8. Criterios de aceptación globales

| ID | Criterio |
|---|---|
| CA-01 | Al pulsar cualquier carta en el explorador de sets (poseída o no), se navega a `/card/[cardId]`. |
| CA-02 | La metadata de catálogo (imagen, nombre, número, set) se muestra sin esperar la respuesta de JustTCG. |
| CA-03 | Con conexión, la sección de precios muestra los 5 estados de condición con su precio en USD. |
| CA-04 | Sin conexión, la sección de precios muestra el último precio NM del `price_cache` y marca las demás condiciones como "No disponible". |
| CA-05 | Si JustTCG no encuentra match para la carta, la sección de precios muestra "Precio no disponible" sin romper el resto de la pantalla. |
| CA-06 | La sección "Mis copias" muestra todas las entradas de inventario de esa carta con colección, cantidad y condición. |
| CA-07 | Pulsar una entrada en "Mis copias" navega al detalle de inventario (`/inventory/[inventoryId]`) de esa entrada. |
| CA-08 | El botón "Agregar a colección" en el detalle de catálogo lleva al flujo de alta con la carta pre-seleccionada. |
| CA-09 | El badge "En inventario" en el explorador de sets muestra la cantidad total de copias en todas las colecciones y no actúa como enlace directo al inventario. |
| CA-10 | El precio NM obtenido en el detalle de catálogo queda reflejado en `price_cache`, manteniendo la coherencia de variación de precio en el inventario. |

---

## 9. Supuestos y decisiones abiertas

### Supuestos

| ID | Supuesto | Rationale |
|---|---|---|
| S-01 | JustTCG, al ser consultado sin filtro de condición (o con todas las condiciones), devuelve variants para las 5 condiciones del dominio cuando están disponibles. Verificado en el código: `client.v1.cards.get({ condition: ["NM","LP","MP","HP","DMG"] })` devuelve variants con campo `condition`. | Basado en la lectura del cliente `justtcg-client.ts` y el tipo `Card.variants`. Requiere validación empírica en implementación. |
| S-02 | Los precios por condición NO se persisten en SQLite porque el `price_cache` actual está diseñado para un solo precio por carta. Extender el esquema por condición añadiría complejidad sin beneficio diferencial claro (los precios de catálogo se consultan bajo demanda, no se usan para calcular valor de colección). | Coherente con la arquitectura existente. Si en el futuro se necesita historial por condición, se añade una tabla `price_cache_by_condition`. |
| S-03 | El acceso al detalle de catálogo desde el listado de cartas de una colección (`/collections/[collectionId]`) NO está incluido en esta feature. La lista de cartas de una colección navega al detalle de inventario. El detalle de catálogo es accesible desde el explorador de sets y desde el flujo de búsqueda/alta. | Separación clara de responsabilidades entre modelos de navegación. |
| S-04 | El detalle de catálogo no incluye un botón de "Refrescar precio global" equivalente al existente en el detalle de inventario. El precio en catálogo se obtiene siempre en tiempo real al abrir la pantalla (sujeto a `staleTime`). | La pantalla de catálogo está orientada a consulta; la de inventario a gestión. |

### Decisiones abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| D-01 | ¿Debe el detalle de catálogo ser accesible también desde el listado de cartas de una colección (como alternativa al detalle de inventario), permitiendo ver precio de mercado actualizado desde el contexto de gestión? | Si se acepta, requiere añadir un botón "Ver en catálogo" en el detalle de inventario o hacer las cards de colección navegables al catálogo. Cambio de UX relevante. |
| D-02 | ¿El `staleTime` de 5 minutos para los precios por condición es el valor adecuado, o se prefiere un valor más largo (ej. 1 hora) para reducir llamadas a JustTCG? | Ajuste de parámetro; impacta en frecuencia de consultas a la API externa. |
| D-03 | ¿Se debe mostrar el precio de la condición que coincide con la copia del usuario de forma destacada (ej. si tiene NM, remarcar el precio NM)? | UX del detalle; requiere cruzar datos de "Mis copias" con la tabla de precios. |
| D-04 | ¿El flujo de alta desde el detalle de catálogo navega a la pantalla `add-card` con la carta pre-seleccionada, o se abre un modal ligero directamente en `/card/[cardId]`? | Decisión de UX e implementación. El modal es más fluido; la pantalla separada es más consistente con el flujo actual. |
