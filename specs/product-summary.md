# Pokemon TCG Collection Manager

## Vision del producto

Crear una aplicacion hibrida (web + movil) para coleccionistas de Pokemon TCG que centralice coleccion, catalogo por sets y evolucion de precios en un solo lugar, con experiencia rapida para uso diario y base solida para crecer a funciones avanzadas.

## Problema que resuelve

Hoy la gestion suele estar dispersa entre notas, hojas de calculo y webs de precios. Eso dificulta:

- Saber exactamente que cartas tienes.
- Detectar duplicados antes de comprar o intercambiar.
- Entender cuanto vale tu coleccion y como cambia con el tiempo.
- Revisar progreso real por set.

## Propuesta de valor

"Tu coleccion, su valor y su progreso por set, todo sincronizado y facil de consultar desde cualquier sitio."

## Usuario objetivo

- Coleccionista activo de Pokemon TCG.
- Compra, vende o intercambia con cierta frecuencia.
- Quiere control practico sin complicarse con herramientas tecnicas.
- Valora datos de mercado para tomar decisiones.

## Fuentes de datos MVP

- Catalogo de cartas por set:
  - Proveedor principal: tcgdex.dev (gratuito para fase inicial).
  - Objetivo: obtener listado completo por set y datos base de carta.
- Precios:
  - Proveedor de precios: JustTCG.
  - Si tcgdex.dev no ofrece precio, JustTCG sera la fuente de precio principal.
- Moneda:
  - La moneda de precio del MVP es **USD**.
  - Nota: la decision inicial de usar EUR fue descartada al confirmar que JustTCG — proveedor de precios seleccionado — retorna precios exclusivamente en USD.

## Escenarios principales de uso

- En casa: revisar coleccion completa, progreso por set y valor total.
- En tienda o evento: buscar una carta por nombre, set o numero y comprobar si ya la tienes.
- Seguimiento: entrar al detalle de una carta y ver si subio o bajo respecto a la ultima consulta.

## Funcionalidades clave del MVP

### Inventario personal de cartas

- Añadir cartas por nombre, set y numero, indicando la colección destino.
- Guardar cantidad por carta.
- Guardar estado de carta usando los estados habituales de TCG.
- Sin cuentas de usuario en MVP (single user local).
- La unicidad de una entrada está determinada por `(cardId, collectionId, condition)`: misma carta + misma condición + misma colección suma cantidad; distinta condición o distinta colección genera entradas independientes.

### Modelo minimo de carta en inventario

- id
- set
- numero
- nombre
- precio_eur
- imagen

Nota: Los campos del dominio se alinearan con el proveedor de cartas para evitar transformaciones innecesarias en fase inicial.

### Catalogo global por set

- Explorar todas las cartas de cada expansion.
- Filtrar y buscar rapidamente.

### Precios integrados

- Consultar precio desde JustTCG.
- Mostrar precio actual en EUR por carta.

### Cambio de precio visible en detalle

- Mostrar variacion desde la ultima revision del usuario.
- Ejemplo: +X% o -Y%.

### Soporte offline parcial

- Consulta offline de cartas ya cargadas o guardadas por el usuario.
- Consulta offline del ultimo precio conocido guardado.
- Sin actualizacion de precio offline.
- Al recuperar conexion, refrescar precios bajo demanda.

## Alcance tecnico MVP

- Sin autenticacion ni cuentas en la primera version.
- Persistencia local para inventario y cache de catalogo y precios vistos.
- Actualizacion de precio en lectura de detalle o por accion manual de refresco.
- Desarrollo y validacion priorizados en navegador durante el MVP.
- Cobertura de tests con enfoque completo: unitarios e integracion en los modulos del MVP.
- Arquitectura preparada para incorporar cuentas y sincronizacion en fases posteriores.

## Elementos diferenciales

- Utilidad rapida en movil y gestion detallada en web.
- Enfoque en decisiones reales del coleccionista: tener o no tener, precio y progreso.
- Arquitectura pensada por fases para evitar sobrecoste al inicio.

## Roadmap de valor

### Fase 1 - MVP

- Inventario de cartas (single user local).
- Catalogo por sets.
- Consulta de precios en EUR.
- Variacion de precio desde la ultima revision.

### Fase 1.5 — Múltiples colecciones — Completada (abril 2026)

- Múltiples colecciones independientes con CRUD completo (crear, renombrar, eliminar).
- Pantalla principal rediseñada como listado de colecciones.
- Mover cartas entre colecciones con merge automático ante colisiones.
- Valor total independiente por colección.
- Indicador de posesión global en el explorador de sets (suma de todas las colecciones).
- Migración automática de inventario legacy a estructura multi-colección.

### Fase 2

- Escaneo por camara.
- Alertas automaticas de precio.
- Cuentas multiusuario y sincronizacion.

### Fase 3

- Wishlist inteligente.
- Objetivos por set.
- Recomendaciones de compra o intercambio.

## Criterios de exito del MVP

- Reducir compras duplicadas en uso real.
- Poder consultar en menos de 10 segundos si una carta ya esta en coleccion.
- Poder ver precio y variacion de una carta en su detalle.
- Poder consultar al menos una parte util de la coleccion sin conexion.

## Estado del MVP

- **Completado** (abril 2026).
- Todas las tareas del plan de implementacion (F1 a F4) finalizadas. Ver `MVP/development-tasks.md` para detalle.

## Feature: Múltiples Colecciones

Permite organizar el inventario en colecciones independientes. Cada colección tiene su propio listado de cartas, valor total y contexto de uso. La pantalla principal muestra el listado de colecciones como punto de entrada en lugar de un listado plano de cartas.

### Funcionalidades

- Crear, renombrar y eliminar colecciones con nombre libre (máx. 50 caracteres, sin duplicados).
- La app garantiza que siempre existe al menos una colección.
- Pantalla de listado de colecciones como pantalla raíz (`app/index.tsx`).
- Pantalla de cartas por colección (`app/collections/[collectionId].tsx`).
- Agregar cartas a una colección; la más antigua queda pre-seleccionada si no hay contexto.
- Mover entradas de inventario entre colecciones con merge automático ante colisiones.
- Valor total calculado por colección de forma independiente.
- La misma carta puede existir en distintas colecciones como entradas completamente independientes.
- Indicador global de posesión en el explorador de sets (suma de todas las colecciones).
- Migración automática de datos legacy (`tcg:inventory:items:v1` → `v2`) en el primer arranque.

## Estado — Feature: Múltiples Colecciones

- **Completada** (abril 2026).
- Todas las tareas del plan de implementación (F1 a F4) finalizadas. Ver `multi-collections/development-tasks.md` para detalle.