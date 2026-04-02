# Tareas de desarrollo - Pokemon TCG Collection Manager

## Resumen

Este desglose cubre la ejecucion del MVP definido en las specs del proyecto y desarrollado en el plan de implementacion. El documento convierte las 4 fases oficiales del plan en tareas accionables, manteniendo el orden, las dependencias y el alcance ya aprobados. Los documentos fuente utilizados son:

- `specs/product-summary.md`
- `specs/mvp-spec.md`
- `specs/tech-stack.md`
- `specs/implementation-plan.md`

## Supuestos

- Se asume que `JustTCG` ofrece una via viable para obtener precio actual en EUR durante el MVP, aunque su formato exacto se validara en implementacion.
- Se asume que el desarrollo se ejecuta con prioridad en navegador, sin excluir comprobaciones posteriores en movil.
- Se asume que el alcance funcional del MVP queda limitado a lo ya descrito en las specs y no incluye funcionalidades de fase 2 o fase 3.

## Sistema de estados

Los estados permitidos para el seguimiento de tareas son: `Pendiente`, `En progreso`, `Bloqueada` y `Completada`. Todas las tareas se inicializan en `Pendiente` hasta que se actualicen durante la ejecucion.

## Tareas por fase

### Fase 1 - Fundacion tecnica

**Objetivo:** dejar el proyecto ejecutable en navegador con la base tecnica del stack, el modelo local de datos y la infraestructura de calidad minima.

| ID | Tarea | Estado | Descripcion | Inputs | Entregable | Criterio de aceptacion | Dependencias | Owner |
|---|---|---|---|---|---|---|---|---|
| F1-T1 | Bootstrap del proyecto Expo web-first | Completada | Crear el proyecto base con Expo, TypeScript y estructura inicial compatible con web y movil, siguiendo el stack aprobado. | `product-summary.md`, `tech-stack.md`, `implementation-plan.md` | Proyecto inicial ejecutable | La app arranca en navegador y existe estructura base del proyecto con scripts funcionales de desarrollo | - | Dev |
| F1-T2 | Configuracion de navegacion y providers globales | Completada | Integrar Expo Router, proveedor de TanStack Query y store base de Zustand en el layout raiz. | `tech-stack.md`, `implementation-plan.md` | Shell de aplicacion con providers globales | Existe layout raiz, navegacion inicial y providers montados sin errores | F1-T1 | Dev |
| F1-T3 | Configuracion de calidad y entorno de test | Completada | Configurar ESLint, Vitest, React Testing Library y checks locales para web. | `product-summary.md`, `tech-stack.md`, `implementation-plan.md` | Tooling de calidad operativo | `lint` y `test` se ejecutan correctamente y al menos un test smoke pasa | F1-T1 | Dev |
| F1-T4 | Definicion del esquema local SQLite | Completada | Crear el esquema Drizzle para `sets`, `cards`, `inventory` y `price_cache`, incluyendo `condition` con estados TCG. | `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Migraciones y modelos de datos | El esquema se aplica localmente y representa todos los campos minimos definidos en specs | F1-T1 | Dev |
| F1-T5 | Repositorios de acceso a datos locales | Completada | Implementar capa de repositorios para CRUD de inventario, lectura de catalogo y cache de precios. | `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Repositorios tipados y reutilizables | Existen operaciones CRUD basicas y consultas de lectura desacopladas de la UI | F1-T4 | Dev |
| F1-T6 | Contratos y clientes base de integracion | Completada | Crear servicios desacoplados para tcgdex y JustTCG con tipados, mapping inicial y manejo basico de errores. | `product-summary.md`, `tech-stack.md`, `implementation-plan.md` | Clientes de integracion encapsulados | Los servicios permiten realizar llamadas controladas y no exponen respuestas crudas a la capa de UI | F1-T1 | Dev |

### Fase 2 - Datos, catalogo e integraciones

**Objetivo:** disponer del catalogo local navegable, sincronizado con tcgdex, y de la capa de precios en EUR desde JustTCG con cache local.

| ID | Tarea | Estado | Descripcion | Inputs | Entregable | Criterio de aceptacion | Dependencias | Owner |
|---|---|---|---|---|---|---|---|---|
| F2-T1 | Descarga inicial de sets | Completada | Implementar la carga inicial de sets desde tcgdex y su persistencia local en SQLite. | `product-summary.md`, `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Sets almacenados localmente | En primer arranque los sets quedan guardados y disponibles para consulta local | F1-T5, F1-T6 | Dev |
| F2-T2 | Descarga inicial de cartas por set | Completada | Implementar la ingesta de cartas por set desde tcgdex y su almacenamiento local. | `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Catalogo de cartas persistido | El catalogo local contiene cartas por set y puede reutilizarse sin nueva descarga inmediata | F2-T1, F1-T5, F1-T6 | Dev |
| F2-T3 | Consultas locales de busqueda y filtros | Completada | Implementar consultas por nombre, numero y set sobre SQLite para uso en navegador. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | API interna de consulta de catalogo | Buscar por nombre o numero devuelve resultados consistentes y filtrables por set | F2-T2 | Dev |
| F2-T4 | Integracion de precios con JustTCG | Completada | Implementar el cliente de precio actual en EUR, persistencia en `price_cache` y control de errores de red. | `product-summary.md`, `tech-stack.md`, `implementation-plan.md` | Servicio de precios operativo | Se puede consultar y guardar precio actual, precio previo y fecha de consulta | F1-T6, F1-T5 | Dev |
| F2-T5 | Modulo de variacion de precio | Completada | Implementar la logica de calculo porcentual y actualizacion de `price_timestamp` para detalle de carta. | `mvp-spec.md`, `implementation-plan.md` | Utilidad de pricing integrada en dominio | La variacion se calcula correctamente en subidas, bajadas y casos sin precio previo valido | F2-T4 | Dev |
| F2-T6 | Validacion temprana de matching tcgdex-JustTCG | Completada | Probar y ajustar el mapeo entre identificadores y metadatos de carta entre ambas fuentes para reducir riesgo posterior. | `product-summary.md`, `tech-stack.md`, `implementation-plan.md` | Estrategia de matching validada | Existe una regla de matching documentada o un adaptador funcional para relacionar cartas y precios | F2-T2, F2-T4 | Dev |

### Fase 3 - Flujos principales de producto

**Objetivo:** construir las pantallas y flujos MVP priorizando navegador: inventario, alta de cartas, detalle, exploracion de sets y cartas.

| ID | Tarea | Estado | Descripcion | Inputs | Entregable | Criterio de aceptacion | Dependencias | Owner |
|---|---|---|---|---|---|---|---|---|
| F3-T1 | Pantalla de inventario personal | Completada | Implementar la pantalla `Mis cartas` con listado, cantidad, estado, precio guardado, variacion y valor total. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | Pantalla de inventario funcional | El usuario puede ver su inventario y el valor total aproximado de su coleccion | F1-T5, F2-T5 | Dev |
| F3-T2 | Filtros y busqueda en inventario | Completada | Anadir filtros por set y busqueda por nombre dentro del inventario. | `mvp-spec.md`, `implementation-plan.md` | Filtros del inventario | El usuario puede localizar cartas del inventario por nombre y set sin inconsistencias | F3-T1 | Dev |
| F3-T3 | Flujo de alta de carta desde catalogo | Completada | Implementar buscador con autocompletado, seleccion de carta y acceso al alta desde el catalogo local. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | Flujo de seleccion de carta para alta | El usuario encuentra una carta por nombre, set o numero y puede seleccionarla para agregarla | F2-T3 | Dev |
| F3-T4 | Persistencia de alta con cantidad y estado | Completada | Implementar formulario de alta con cantidad, `condition`, validaciones y merge de duplicados. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | Alta de inventario operativa | Si la carta ya existe, se suma cantidad; si no existe, se crea con estado y precio guardado cuando aplique | F3-T3, F2-T4, F1-T5 | Dev |
| F3-T5 | Pantalla de detalle de carta del inventario | Completada | Implementar detalle con imagen, precio guardado, precio actual, variacion, timestamp y accion de refresco. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | Pantalla de detalle de carta | El detalle muestra metadatos y permite refrescar precio bajo demanda con feedback de carga/error | F2-T5, F3-T1 | Dev |
| F3-T6 | Explorador de sets y cartas | Completada | Implementar listado de sets, listado de cartas del set y badge de posesion en inventario. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | Pantallas de catalogo por set | El usuario puede navegar sets, buscar cartas del set y ver si ya las tiene | F2-T2, F2-T3, F1-T5 | Dev |
| F3-T7 | Edicion y borrado de inventario | Completada | Implementar actualizacion de cantidad/estado y borrado de cartas desde el inventario. | `mvp-spec.md`, `implementation-plan.md` | CRUD completo de inventario | El usuario puede editar o eliminar una carta sin dejar inconsistencias en inventario o valor total | F3-T1, F3-T5 | Dev |

### Fase 4 - Offline, calidad y cierre MVP

**Objetivo:** asegurar comportamiento offline parcial, robustez funcional en navegador y un nivel de calidad suficiente para demo o uso real.

| ID | Tarea | Estado | Descripcion | Inputs | Entregable | Criterio de aceptacion | Dependencias | Owner |
|---|---|---|---|---|---|---|---|---|
| F4-T1 | Deteccion de conectividad y modo offline | Completada | Implementar estado global de conectividad y comportamiento de la UI para operaciones online/offline. | `product-summary.md`, `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Modo offline visible y controlado | La app informa cuando esta offline y bloquea solo las acciones que requieren red | F3-T1, F3-T5, F3-T6 | Dev |
| F4-T2 | Lectura offline de inventario y catalogo cacheado | Completada | Garantizar consulta local de inventario, catalogo ya descargado y ultimo precio conocido sin conexion. | `product-summary.md`, `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Soporte offline parcial operativo | Sin conexion el usuario puede consultar inventario, catalogo cacheado y ultimo precio conocido | F4-T1, F2-T2, F2-T4 | Dev |
| F4-T3 | Suite de tests unitarios de dominio e integraciones | Completada | Implementar tests unitarios para variacion de precio, repositorios, adaptadores tcgdex/JustTCG y reglas de inventario. | `mvp-spec.md`, `tech-stack.md`, `implementation-plan.md` | Cobertura de unit tests | Los modulos criticos tienen tests estables y cubren casos borde relevantes | F1-T3, F2-T5, F3-T7 | Dev |
| F4-T4 | Suite de tests de integracion de flujos MVP | Completada | Implementar pruebas de integracion para alta de carta, inventario, refresco de precio, explorador y offline principal. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | Flujos criticos cubiertos por tests | Los flujos principales pasan en navegador con mocks controlados y sin depender de APIs reales | F1-T3, F3-T4, F3-T5, F3-T6, F4-T2 | Dev |
| F4-T5 | Estados vacios, errores y loading | Completada | Ajustar la experiencia en estados vacios, errores de red, carga inicial y fallback de precio no disponible. | `product-summary.md`, `mvp-spec.md`, `implementation-plan.md` | UI resiliente en estados no ideales | Todas las pantallas principales muestran feedback adecuado en vacio, error y carga | F3-T1, F3-T5, F3-T6, F4-T1 | Dev |
| F4-T6 | Pulido responsive y hardening final | Completada | Revisar responsive web, rendimiento basico y consistencia funcional para dejar el MVP listo para demo o uso real. | `product-summary.md`, `tech-stack.md`, `implementation-plan.md` | MVP cerrado y estable | Los flujos criticos funcionan sin bloqueos y la UI responde correctamente en navegador | F4-T2, F4-T3, F4-T4, F4-T5 | Dev |

## Ruta critica reflejada

Las tareas que reflejan la ruta critica del plan son:

- `F1-T1` Bootstrap del proyecto Expo web-first
- `F1-T4` Definicion del esquema local SQLite
- `F1-T6` Contratos y clientes base de integracion
- `F2-T1` Descarga inicial de sets
- `F2-T2` Descarga inicial de cartas por set
- `F2-T4` Integracion de precios con JustTCG
- `F2-T5` Modulo de variacion de precio
- `F3-T1` Pantalla de inventario personal
- `F3-T4` Persistencia de alta con cantidad y estado
- `F3-T5` Pantalla de detalle de carta del inventario
- `F4-T1` Deteccion de conectividad y modo offline
- `F4-T4` Suite de tests de integracion de flujos MVP
- `F4-T6` Pulido responsive y hardening final

## Riesgos trasladados a ejecucion

| Riesgo | Tareas que lo mitigan | Enfoque de mitigacion |
|---|---|---|
| JustTCG puede cambiar formato o tener limites | `F1-T6`, `F2-T4`, `F4-T4` | Encapsular cliente, aislar adaptadores y validar flujo con mocks en tests de integracion |
| Matching entre tcgdex y JustTCG puede ser inconsistente | `F2-T4`, `F2-T6`, `F4-T3` | Validar estrategia de matching temprano y cubrirla con tests unitarios |
| Carga completa del catalogo puede degradar rendimiento web | `F2-T1`, `F2-T2`, `F2-T3`, `F4-T6` | Persistencia local, consultas eficientes y revision final de rendimiento |
| Diferencias entre Expo web y movil | `F1-T1`, `F1-T2`, `F4-T6` | Priorizar navegador desde el inicio y revisar compatibilidad durante el hardening |
| Alta carga de testing puede retrasar el MVP | `F1-T3`, `F4-T3`, `F4-T4` | Preparar tooling temprano y concentrar cobertura en modulos y flujos criticos |
| Evolucion futura a multiusuario puede requerir cambios de arquitectura | `F1-T5`, `F1-T6`, `F4-T6` | Mantener repositorios y servicios desacoplados del almacenamiento y de la UI |

## Siguiente bloque recomendado

El primer bloque recomendado para ejecutar es:

1. `F1-T1` Bootstrap del proyecto Expo web-first
2. `F1-T2` Configuracion de navegacion y providers globales
3. `F1-T3` Configuracion de calidad y entorno de test
4. `F1-T4` Definicion del esquema local SQLite
5. `F1-T6` Contratos y clientes base de integracion

Este bloque deja desbloqueadas las decisiones estructurales del MVP y prepara la base para ingesta de catalogo, pricing y construccion de pantallas.