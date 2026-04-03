# Feature Specification — Múltiples Colecciones

---

## 1. Objetivo

Permitir al usuario organizar sus cartas en colecciones independientes (ej. "Mi álbum principal", "Bulk para cambiar", "Le presto a Luis"), cada una con su propio inventario, valor total y contexto de uso. La misma carta puede existir en varias colecciones como entradas independientes. La app nunca muestra un listado plano de "todas las cartas" como pantalla de inicio: la navegación parte siempre de una colección concreta o de la gestión de colecciones.

---

## 2. Alcance

### Incluido
- Crear colecciones con nombre libre.
- Renombrar cualquier colección.
- Eliminar colecciones no-predeterminadas (con comportamiento de seguridad definido).
- Colección por defecto ("Mi colección") siempre presente, no eliminable.
- Agregar cartas indicando la colección destino (con la primera colección, más antigua, pre-seleccionada).
- Mover una entrada de inventario de una colección a otra.
- Pantalla de gestión/listado de colecciones como punto de entrada principal.
- Pantalla de cartas por colección (actual "Mis cartas" reenfocada a una colección).
- Valor total calculado por colección de forma independiente.
- Indicador global de posesión en el explorador de sets ("la tengo en alguna colección").
- Migración de datos del inventario existente (web localStorage v1 → v2 con collectionId).

### Excluido
- Vista unificada de "todas las cartas de todas las colecciones" (decisión abierta para feature futura).
- Valor total global de todas las colecciones sumadas (fuera de scope en esta fase).
- Colecciones con metadatos adicionales: descripción, color, icono.
- Compartir colecciones con otros usuarios.
- Exportación de colecciones.
- Colecciones anidadas o jerarquías.

### Dependencias con specs globales
- Modelo de datos `inventory` definido en `specs/MVP/mvp-spec.md` §2.2 — esta feature extiende ese esquema.
- Flujo de alta de carta `specs/MVP/mvp-spec.md` §3.2 — se adapta para incluir selección de colección.
- Flujo de inventario `specs/MVP/mvp-spec.md` §3.1 — se segmenta por colección.
- Stack Drizzle + expo-sqlite + localStorage dual descrito en `specs/tech-stack.md` — aplica sin cambios de tecnología.

---

## 3. Actores

| Actor | Descripción |
|---|---|
| Usuario coleccionista | Único actor. Single-user, sin autenticación. Crea y gestiona sus colecciones de forma local. |

---

## 4. Estructura de datos

### 4.1 Nueva tabla: `collections`

```typescript
collectionsTable = sqliteTable("collections", {
  id: text("id").primaryKey(),                     // "col_<timestamp>_<random>"
  name: text("name").notNull(),                    // Nombre libre, max 50 chars
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
})
```

**Invariante:** existe siempre al menos una colección. La app crea automáticamente una colección llamada "Mi colección" en el primer arranque o cuando no existe ninguna. Esta colección no tiene ningún atributo diferencial: se puede renombrar y eliminar como cualquier otra, siempre que quede al menos otra colección. No existe flag `isDefault`.

### 4.2 Tabla `inventory` — campo añadido

```typescript
// Campo nuevo en inventoryTable:
collectionId: text("collection_id")
  .notNull()
  .references(() => collectionsTable.id, { onDelete: "restrict" })

// Restricción unique nueva (reemplaza a la lógica de merge por cardId):
// UNIQUE(card_id, collection_id, condition)
// → Una carta con la misma condición puede aparecer una sola vez por colección.
// → La misma carta puede existir en la misma colección con distintas condiciones (entradas independientes).
// → La misma carta puede existir en N colecciones distintas.
```

**UNIQUE(cardId, collectionId, condition):** sustituye la lógica actual de "ya existe → suma cantidad". La fusión de duplicados ocurre únicamente cuando coinciden la misma carta, la misma colección Y la misma condición.

### 4.3 Web storage (localStorage)

| Clave | Descripción |
|---|---|
| `tcg:collections:v1` | Array de colecciones `{id, name, createdAt}` |
| `tcg:inventory:items:v2` | Array de entradas con campo `collectionId` añadido |
| `tcg:inventory:items:v1` | Clave legacy — se migra en primer arranque (ver §5.5) |

### 4.4 Tipos derivados

```typescript
type CollectionSummary = {
  collectionId: string;
  name: string;
  totalCardsCount: number;         // suma de quantity de todas las entradas
  totalUniqueCardsCount: number;   // número de entradas distintas (por card+condición)
  totalCollectionValueUsd: number; // suma de (quantity × priceUsd) por entrada
  createdAt: Date;
};
```

---

## 5. Flujos funcionales

### 5.1 Flujo: Ver listado de colecciones (pantalla principal)

**Trigger:** Usuario abre la app / navega a la pantalla raíz.

**Precondiciones:** Existe siempre al menos una colección.

**Pasos:**
1. La app muestra la pantalla de colecciones como punto de entrada.
2. Se lista cada colección con: nombre, número de cartas únicas, valor total aproximado.
3. Las colecciones se ordenan por defecto por fecha de creación (más antigua primero). El usuario puede cambiar el orden por: nombre, número de cartas o valor total; tanto ascendente como descendente.
4. Boton “Nueva colección” visible en todo momento.
5. Al pulsar una colección, se navega a su pantalla de cartas (`/collections/[collectionId]`).
6. Pulsación larga (o menú contextual) muestra opciones: renombrar, eliminar.
7. La opción “Eliminar” aparece en todas las colecciones excepto si solo queda una.

**Postcondiciones:** El usuario ha accedido al listado de colecciones y puede navegar a cualquiera.

**Error / edge cases:**
- Si solo existe una colección (la auto-creada) y está vacía: se muestra con estado vacío y CTA "Agregar primera carta".
- Error de lectura de base de datos: se muestra estado de error con opción de reintentar.

**UI hints:**
- Lista de cards con nombre, badge de cantidad de cartas y valor total.
- Controles de ordenación visibles (por: antigua-nueva / nombre / nº cartas / valor; asc/desc).
- Botón "Nueva colección" en cabecera o zona fija inferior.

---

### 5.2 Flujo: Crear colección

**Trigger:** Usuario pulsa "Nueva colección".

**Precondiciones:** —

**Pasos:**
1. Se abre un modal o pantalla de creación con campo de nombre (texto libre).
2. El usuario escribe un nombre y confirma.
3. El sistema valida: nombre no vacío, longitud ≤ 50 caracteres, no duplicado exacto (case-insensitive).
4. Se genera `id = "col_<timestamp>_<random>"` y se persiste.
5. La nueva colección aparece en el listado.

**Postcondiciones:** Colección creada y visible. El usuario puede empezar a agregar cartas.

**Error / edge cases:**
- Nombre vacío: no se permite confirmar, mensaje de validación inline.
- Nombre duplicado: error inline "Ya tienes una colección con ese nombre".
- Nombre > 50 chars: campo con contador de caracteres y bloqueo al límite.

---

### 5.3 Flujo: Ver cartas de una colección

**Trigger:** Usuario pulsa una colección del listado.

**Precondiciones:** La colección existe.

**Pasos:**
1. Se navega a `/collections/[collectionId]`.
2. Se muestra el nombre de la colección en la cabecera.
3. Se lista las entradas de inventario de esa colección (misma UI que la actual pantalla "Mis cartas" pero filtrada).
4. Se muestra valor total y total de cartas de esa colección.
5. Buscador por nombre y filtro por set (igual que flujo actual) pero scoped a la colección activa.
6. Botón "Agregar carta" pre-selecciona esta colección.

**Postcondiciones:** El usuario ve solo las cartas de la colección seleccionada.

**Error / edge cases:**
- Colección vacía: estado vacío con CTA "Agregar carta".
- collectionId no encontrado: error con navegación de vuelta al listado.

---

### 5.4 Flujo: Agregar carta a una colección

**Trigger:** Usuario pulsa "Agregar carta" desde cualquier contexto.

**Precondiciones:** Existen sets y cartas sincronizadas en catálogo.

**Pasos:**
1. Si se accede desde `/collections/[collectionId]`: la colección destino queda pre-seleccionada.
2. Si se accede desde un contexto global (ej. desde el detalle de catálogo): se muestra selector de colección con la primera colección (más antigua) pre-seleccionada.
3. El usuario busca y selecciona una carta del catálogo (flujo actual sin cambios).
4. El formulario de alta muestra adicionalmente el selector/confirmación de colección destino.
5. El usuario introduce cantidad, condición y confirma la colección.
6. El sistema valida si ya existe `(cardId, collectionId, condition)`:
   - Si existe: suma la cantidad ingresada a la entrada existente.
   - Si no existe: crea nueva entrada con `collectionId` y `condition` asignados.
7. Si hay conexión: intenta obtener precio de JustTCG y lo guarda en la entrada.
8. Se navega de vuelta con confirmación de éxito.

**Postcondiciones:** La carta queda en la colección indicada. Si ya estaba, se sumó la cantidad.

**Error / edge cases:**
- Sin conexión: la carta se agrega sin precio guardado; `priceUsd = null`.
- Cantidad ≤ 0: validación inline, no se puede confirmar.
- Colección eliminada durante el flujo (edge case): se redirige al listado de colecciones con aviso.

---

### 5.5 Flujo: Migración de datos legacy (web)

**Trigger:** Primer arranque de la app después de actualizar.

**Precondiciones:** Existe `tcg:inventory:items:v1` en localStorage.

**Pasos:**
1. Al inicializar, el sistema detecta la existencia de `tcg:inventory:items:v1`.
2. Si no existe `tcg:collections:v1`: se crea con la colección auto-creada "Mi colección".
3. Por cada entrada en `tcg:inventory:items:v1`: se crea una entrada equivalente en `tcg:inventory:items:v2` asignando el `id` de la colección auto-creada.
4. Se elimina (o marca como migrado) `tcg:inventory:items:v1`.
5. La app continúa normalmente.

**Postcondiciones:** El usuario no percibe pérdida de datos. Todas las cartas del inventario anterior quedan en la colección auto-creada "Mi colección".

**Error / edge cases:**
- Error al escribir en `v2` durante migración: se aborta, se conserva `v1` intacto. El usuario puede reintentar en el próximo arranque.
- Si `v1` y `v2` coexisten sin marca de migración: se prioriza `v2` y se ignora `v1`.

---

### 5.6 Flujo: Mover carta entre colecciones

**Trigger:** Usuario accede al detalle de una entrada de inventario y elige "Mover a colección".

**Precondiciones:** Existen ≥ 2 colecciones. La entrada de inventario existe.

**Pasos:**
1. Desde el detalle de inventario (`/inventory/[inventoryId]`), se muestra un botón "Mover a colección".
2. Se abre un selector con las colecciones disponibles, excluyendo la colección actual.
3. El usuario selecciona la colección destino.
4. El sistema verifica si ya existe `(cardId, collectionDestino, condition)`:
   - Si NO existe: se actualiza el `collectionId` de la entrada, conservando todos los demás campos (cantidad, condición, precio, timestamp).
   - Si SÍ existe: se muestra aviso “Ya tienes esta carta en esa condición en esa colección. Si confirmas, se sumará la cantidad a la entrada existente y se eliminará esta.” El usuario confirma o cancela. Si confirma: se suman las cantidades, se conserva el precio más reciente por `priceTimestamp`, y se elimina la entrada origen.
5. Se navega de vuelta a la colección origen (ahora sin esa carta).

**Postcondiciones:** La carta está en la colección destino. La colección origen ya no la contiene.

**Error / edge cases:**
- Solo existe una colección: el botón "Mover" no aparece.
- La colección destino se elimina mientras el modal está abierto: se refresca el listado y se muestra aviso.

---

### 5.7 Flujo: Renombrar colección

**Trigger:** Usuario elige "Renombrar" en el menú contextual de una colección.

**Pasos:**
1. Se abre un modal con el nombre actual pre-relleno.
2. El usuario modifica el nombre y confirma.
3. Validaciones: igual que §5.2 (no vacío, ≤ 50 chars, no duplicado).
4. Se persiste el nuevo nombre.
5. El listado se actualiza inmediatamente.

**Error / edge cases:** ídem §5.2.

---

### 5.8 Flujo: Eliminar colección

**Trigger:** Usuario elige "Eliminar" en el menú contextual de una colección.

**Precondiciones:** Existen al menos dos colecciones.

**Pasos:**
1. Se muestra un diálogo de confirmación con dos variantes:
   - **Si la colección está vacía:** confirmación simple "¿Eliminar '[nombre]'? Esta acción no se puede deshacer."
   - **Si la colección tiene cartas:** el diálogo muestra "Para eliminar '[nombre]' debes mover sus [N] entradas a otra colección. Selecciona la colección destino:" con un selector que incluye todas las colecciones existentes excepto la que se va a eliminar.
2. Variante vacía: el usuario confirma y la colección se elimina.
3. Variante con cartas: el usuario selecciona una colección destino y confirma.
   - Se reasignan todas las entradas de inventario a la colección destino, respetando la regla UNIQUE(cardId, collectionId, condition):
     - Si ya existe `(cardId, collectionDestino, condition)`: se suman cantidades y se elimina la entrada origen.
     - Si no existe: se actualiza `collectionId` directamente.
   - Se elimina la colección.

**Postcondiciones:** La colección no existe. Las cartas (si las había) están en la colección destino seleccionada.

**Error / edge cases:**
- Si solo existe una colección, la opción "Eliminar" no aparece en ningún menú contextual.
- Error durante reasignación: operación atómica; si falla, no se elimina la colección.

---

## 6. Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | Existe siempre al menos una colección. La app auto-crea "Mi colección" en el primer arranque o cuando no existe ninguna. No existe atributo `isDefault`: todas las colecciones son equivalentes en comportamiento. |
| RN-02 | Una colección solo puede eliminarse si existen al menos dos colecciones. La última colección no puede eliminarse bajo ninguna circunstancia. |
| RN-03 | Cualquier colección puede renombrarse, incluida la auto-creada "Mi colección". |
| RN-04 | Una tripleta `(cardId, collectionId, condition)` tiene como máximo una entrada en `inventory`. Al agregar la misma carta con la misma condición en la misma colección, se suma la cantidad. La misma carta con distinta condición genera una entrada separada. |
| RN-05 | La misma carta puede existir en distintas colecciones como entradas completamente independientes (precio, cantidad y condición propios). |
| RN-06 | El precio de mercado es global por `(cardId, condition)`, no por colección. Un refresco de precio actualiza `priceUsd` únicamente en la entrada de inventario concreta que se refresca, usando el precio de mercado correspondiente a su condición. |
| RN-07 | El valor total de una colección es la suma de `quantity × priceUsd` de sus entradas. Las entradas sin precio no contribuyen al valor. |
| RN-08 | No puede haber dos colecciones con nombres idénticos (comparación case-insensitive, después de trim). |
| RN-09 | El nombre de una colección tiene longitud máxima de 50 caracteres y no puede estar vacío. |
| RN-10 | Para eliminar una colección con cartas, el usuario debe seleccionar una colección destino. La operación de reasignación y eliminación es atómica: si falla la reasignación, no se elimina la colección. |
| RN-11 | Durante la reasignación de cartas al eliminar una colección, si ya existe `(cardId, collectionDestino, condition)`, se suman cantidades y se conserva el `priceUsd` más reciente por `priceTimestamp`. |
| RN-12 | El indicador de posesión en el explorador de sets ("En inventario") es global: se activa si la carta existe en cualquiera de las colecciones, y muestra la cantidad total sumada. |

---

## 7. Requisitos no funcionales

- **Migración sin pérdida de datos:** la migración de `v1` → `v2` en web debe ser idempotente y reversible en caso de fallo.
- **Atomicidad en operaciones destructivas:** eliminación de colección y reasignación de cartas deben ejecutarse como transacción (SQLite nativo) o con rollback controlado (localStorage web).
- **Offline:** la gestión de colecciones (crear, renombrar, ver cartas) está disponible offline. Las operaciones que no requieren red (inventario puro) no se bloquean.
- Referencia a NFRs globales de MVP: rendimiento, soporte web/nativo y cobertura de tests definidos en `specs/MVP/mvp-spec.md` §4.

---

## 8. Criterios de aceptación globales

| ID | Criterio |
|---|---|
| CA-01 | La pantalla de inicio muestra el listado de colecciones, no un listado plano de cartas. |
| CA-02 | El usuario puede crear una colección nueva y agregar cartas a ella. |
| CA-03 | Siempre existe al menos una colección. La última colección no puede eliminarse. |
| CA-04 | La misma carta puede existir en dos colecciones distintas, o en la misma colección con distintas condiciones, como entradas independientes. |
| CA-05 | Al agregar una carta con la misma condición a una colección donde ya existe esa combinación, se suma la cantidad en lugar de crear duplicado. |
| CA-06 | Mover una carta entre colecciones transfiere todos los metadatos (precio, condición, cantidad) y elimina la entrada origen. |
| CA-07 | El valor total mostrado en cada colección es la suma correcta de `quantity × priceUsd` de sus entradas. |
| CA-08 | Un refresco de precio desde el detalle de inventario actualiza el precio de esa entrada usando el precio de mercado para su condición específica. |
| CA-09 | La migración de datos `v1 → v2` convierte el inventario existente sin pérdida, asignando todas las cartas a la colección auto-creada. |
| CA-10 | Al intentar eliminar una colección con cartas, el usuario debe seleccionar una colección destino antes de confirmar; no existe opción de eliminar directamente. |
| CA-11 | El explorador de sets sigue mostrando correctamente el indicador "En inventario" con la cantidad total a través de todas las colecciones. |

---

## 9. Supuestos y decisiones abiertas

### Supuestos

| ID | Supuesto | Rationale |
|---|---|---|
| S-01 | UNIQUE(cardId, collectionId, condition) es la granularidad correcta: una carta con una condición específica puede aparecer una única vez por colección. La misma carta puede estar en la misma colección con distintas condiciones (ej. NM y LP) como entradas separadas e independientes. | Confirmado por el usuario. Refleja el caso de uso real: un Mewtwo NM y un Mewtwo LP en el mismo álbum son entradas distintas. |
| S-02 | El campo `collectionId` se añade como `NOT NULL` en la tabla `inventory`. Todas las filas existentes reciben el id de la colección auto-creada durante la migración de base de datos nativa. | Garantiza integridad referencial desde el día 1. |
| S-03 | La colección auto-creada se llama "Mi colección", pero no existe ningún flag `isDefault` ni atributo especial. Es una colección ordinaria identificada únicamente por su `id`. El nombre "Mi colección" no tiene ningún significado para la lógica de negocio. | Confirmado por el usuario. Simplifica el modelo: no hay casos especiales en código para la colección inicial. |
| S-04 | El precio de mercado es global por `(cardId, condition)`, no por colección. El `price_cache` existente almacena el precio de referencia NM (o el mejor disponible) por `cardId`. El refresco de precio en una entrada de inventario obtiene el precio para la condición de esa entrada específica y lo guarda en `priceUsd` de esa entrada únicamente. No existe un mecanismo de propagación de precio a otras entradas. | Confirmado por el usuario. El precio de mercado varía por condición; propagarlo a todas las entradas sería incorrecto si tienen distintas condiciones. |
| S-05 | La pantalla de "todas las cartas de todas las colecciones" queda fuera de scope. Si se añade en el futuro, sería una sección dedicada, no la pantalla de inicio. | El usuario lo confirmó explícitamente. |

### Decisiones abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| ~~D-01~~ | ~~¿Debe existir un orden personalizable entre colecciones?~~ **Resuelto:** orden por defecto es fecha de creación (más antigua primero). Opciones de ordenación disponibles: nombre, número de cartas, valor total. Cada opción admite dirección ascendente y descendente. | Resuelto. |
| ~~D-02~~ | ~~¿La navegación principal de la app (actual `app/index.tsx`) se convierte en la pantalla de colecciones, o se añade un tab/sección dedicada?~~ **Resuelto:** `app/index.tsx` se convierte en la pantalla de listado de colecciones. La pantalla de cartas de cada colección pasa a `app/collections/[collectionId].tsx`. La ruta `app/inventory/[inventoryId].tsx` se conserva sin cambios. | Resuelto. |
| D-03 | ¿La vista de "todas las cartas" (excluida de scope) se planifica para la siguiente iteración o se deja como decisión abierta indefinida? | Roadmap. |
| ~~D-04~~ | ~~¿Cuándo se elimina una colección con cartas, puede el usuario elegir la colección destino?~~ **Resuelto:** no se puede eliminar una colección con cartas sin seleccionar destino. El diálogo exige seleccionar una colección destino (cualquiera de las existentes menos la eliminada) antes de confirmar. | Resuelto. |
