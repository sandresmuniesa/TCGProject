# MVP Specification - Pokemon TCG Collection Manager

## Objetivo del MVP

Permitir a un usuario coleccionista gestionar su inventario de cartas Pokemon TCG, consultar precio desde JustTCG, ver variación de precios y explorar el catálogo completo por sets.

---

## 1. Pilares funcionales del MVP

### 1.1 Gestión de Inventario
- Crear lista personal de cartas que el usuario posee.
- Almacenar: id carta, set, número, nombre, cantidad, estado, precio guardado.
- Editar cantidad y borrar cartas del inventario.
- Persistencia local (sin servidor inicialmente).

### 1.2 Catálogo Global por Set
- Listar todos los sets disponibles.
- Explorar cartas dentro de cada set.
- Búsqueda y filtrado rápido por nombre/número.
- Fuente: tcgdex.dev (API gratuita).

### 1.3 Precios y Variación
- Obtener precio actual desde JustTCG (EUR).
- Guardar precio al momento en que el usuario consulta una carta.
- Mostrar variación % desde último precio guardado vs. precio actual.
- Actualizar precio bajo demanda (botón refresh en detalle).

### 1.4 Soporte Offline Parcial
- Consultar cartas ya cargadas en cache local.
- Ver último precio conocido sin conexión.
- Sin actualización de precio en offline.
- Sincronización automática al recuperar conexión.

---

## 2. Estructura de datos

### 2.1 Carta en Catálogo (de tcgdex.dev)

```json
{
  "id": "string",
  "set": "string",
  "number": "string",
  "name": "string",
  "image_url": "string",
  "otros_campos": "de tcgdex"
}
```

### 2.2 Carta en Inventario Personal

```json
{
  "inventory_id": "uuid",
  "card_id": "string (referencia a catálogo)",
  "set": "string",
  "number": "string",
  "name": "string",
  "quantity": "integer (cuántas tiene el usuario)",
  "condition": "Near Mint | Lightly Played | Moderately Played | Heavily Played | Damaged",
  "price_eur": "decimal (precio guardado en ese momento)",
  "price_timestamp": "datetime (cuándo se guardó ese precio)",
  "added_at": "datetime"
}
```

### 2.3 Precio Actual (cache local de JustTCG)

```json
{
  "card_id": "string",
  "current_price_eur": "decimal",
  "fetched_at": "datetime",
  "previous_price_eur": "decimal (opcional)"
}
```


---

## 3. Flujos principales

### 3.1 Flujo: Ver Inventario Personal

**Pantalla: Mis cartas**
1. Listar todas las cartas agregadas por el usuario.
2. Mostrar por cada carta:
   - Nombre + set + número
   - Cantidad
   - Precio guardado + % variación (si hay precio actual descargado)
   - Imagen (thumbnail)
3. Filtros básicos: por set, búsqueda por nombre.
4. Botón "Agregar carta".

**Datos mostrados:**
- Total cartas en colección (count)
- Valor total aproximado de colección (suma de cantidad × precio).

---

### 3.2 Flujo: Agregar Carta al Inventario

**Pantalla: Agregar carta**
1. Mostrar buscador con autocompletado (búsqueda en catálogo tcgdex).
2. Usuario digita nombre/set/número.
3. Resultado: lista de cartas coincidentes.
4. Usuario selecciona una carta.
5. Mostrar detalle: nombre, imagen, set, número, precio actual (si disponible).
6. Input: cantidad a agregar.
7. Botón "Guardar a inventario".

**Reglas:**
- Si carta ya existe en inventario: sumar cantidad.
- Guardar precio actual de JustTCG en el momento de agregar (si conexión disponible).
- Si sin conexión: guardar sin precio, actualizarlo cuando vuelva conexión.

**Validaciones:**
- Cantidad > 0.
- Carta debe existir en catálogo.

---

### 3.3 Flujo: Ver Detalle de Carta en Inventario

**Pantalla: Detalle carta**
1. Mostrar:
   - Imagen grande
   - Nombre, set, número
   - Cantidad en colección
   - Precio guardado (momento en que se agregó o último refresh)
   - Precio actual (si disponible)
   - Variación % (rojo si bajó, verde si subió)
   - Timestamp de última actualización de precio
2. Botones:
  - "Refrescar precio" (trae precio actual de JustTCG)
   - "Editar cantidad"
   - "Eliminar de inventario"

**Reglas si Refrescar Precio:**
- Requiere conexión.
- Diferencia con precio anterior % = ((nuevo - anterior) / anterior) × 100.
- Guardar como nuevo precio guardado.
- Actualizar timestamp.

---

## 4. Requisitos no funcionales

- Plataforma prioritaria para desarrollo y validacion: navegador.
- Estrategia de calidad del MVP: tests unitarios e integracion en todos los modulos principales.