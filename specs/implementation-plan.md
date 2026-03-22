# Plan de Implementacion - Pokemon TCG Collection Manager

## Resumen del plan

El plan cubre la construccion del MVP definido en las specs actuales: app web + movil con codebase unico, inventario personal local, catalogo por sets desde tcgdex.dev, precios en EUR desde JustTCG, variacion de precio por carta, soporte offline parcial y cobertura de tests unitarios e integracion. La ejecucion se divide en 4 fases principales: base tecnica, capa de datos e integraciones, flujos de producto y calidad/pulido. Estimacion total para un desarrollador mid-senior trabajando solo: **111 horas (~14 dias laborables)**. Estimacion total para un desarrollador apoyado por IA: **51 horas (~6.5 dias laborables)**.

## Areas grises resueltas

| Area gris | Tipo | Resolucion |
|---|---|---|
| Proveedor de precios del MVP | Bloqueante | Se sustituye Cardmarket por JustTCG en todas las specs. |
| Estado de la carta en inventario | Bloqueante | Se usaran los estados habituales de TCG: Near Mint, Lightly Played, Moderately Played, Heavily Played y Damaged. |
| Estrategia de testing del MVP | Importante | Se adopta la opcion C: tests unitarios e integracion para los modulos principales del MVP. |
| Plataforma prioritaria de desarrollo | Importante | El desarrollo, QA inicial y validacion principal se priorizan en navegador. |
| Disponibilidad exacta y limites de JustTCG | Menor | Se asume integracion viable; se planifica encapsular el cliente y mockear respuestas para no bloquear desarrollo. |
| Diseno visual detallado | Menor | Se asume diseno funcional sin dependencia de Figma previo. |
| Idioma de interfaz | Menor | Se asume interfaz inicial en espanol. |

## Plan por fases

### Fase 1 - Fundacion tecnica

**Objetivo:** dejar el proyecto ejecutable en navegador con la base tecnica del stack, el modelo local de datos y la infraestructura de calidad minima.

| # | Tarea | Descripcion | Entregable | Criterio de aceptacion | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 1.1 | Inicializar proyecto base | Owner: Dev. Inputs: product-summary.md, tech-stack.md. Crear proyecto Expo con TypeScript, Expo Router, NativeWind, TanStack Query, Zustand y configuracion web prioritaria. IA acelera scaffolding y wiring inicial. | Proyecto arrancable en navegador con estructura base | La app arranca en web, existe layout base y scripts de desarrollo/lint/test | - | 8h | 3h |
| 1.2 | Configurar calidad y tooling | Owner: Dev. Inputs: tech-stack.md. Configurar ESLint, Prettier si aplica, Vitest, React Testing Library y pipeline local de checks. IA acelera configuracion repetitiva de tooling y tests smoke. | Tooling de calidad operativo | `lint` y `test` ejecutan correctamente y hay un test smoke pasando | 1.1 | 6h | 2h |
| 1.3 | Definir esquema local y repositorios | Owner: Dev. Inputs: product-summary.md, mvp-spec.md, tech-stack.md. Modelar tablas `sets`, `cards`, `inventory` y `price_cache` con Drizzle sobre expo-sqlite, incluyendo `condition`. IA acelera generacion de schemas y repositorios CRUD. | Esquema local y capa de acceso a datos | Migraciones aplican en local y existen repositorios con operaciones CRUD basicas | 1.1 | 8h | 3h |
| 1.4 | Definir clientes de integracion | Owner: Dev. Inputs: product-summary.md, tech-stack.md. Crear contratos/servicios para tcgdex y JustTCG encapsulando fetch, mapeos y errores. IA acelera DTOs, tipados y manejo base de errores. | Clientes de API desacoplados | Existen servicios tipados y testeables para catalogo y precios, sin acoplar UI a respuestas crudas | 1.1 | 5h | 2h |

**Subtotal fase 1:** Humano **27h** | Humano+IA **10h**

### Fase 2 - Datos, catalogo e integraciones

**Objetivo:** disponer del catalogo local navegable, sincronizado con tcgdex, y de la capa de precios en EUR desde JustTCG con cache local.

| # | Tarea | Descripcion | Entregable | Criterio de aceptacion | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 2.1 | Ingesta inicial de sets y cartas | Owner: Dev. Inputs: mvp-spec.md, tech-stack.md. Implementar descarga inicial de sets/cartas desde tcgdex, persistencia local y refresco manual. IA acelera parsing, mapeo y utilidades de sincronizacion. | Catalogo local poblado desde tcgdex | Primer arranque descarga catalogo y quedan datos consultables en SQLite | 1.3, 1.4 | 10h | 4h |
| 2.2 | Busqueda y filtros de catalogo | Owner: Dev. Inputs: mvp-spec.md. Implementar consultas locales por nombre, numero y set, optimizadas para navegador. IA acelera hooks, selectors y pruebas de busqueda. | API interna de busqueda/filtro | Buscar por nombre o numero devuelve resultados consistentes en <500 ms sobre datos locales de prueba | 1.3, 2.1 | 7h | 3h |
| 2.3 | Integracion de precios JustTCG | Owner: Dev. Inputs: product-summary.md, tech-stack.md. Implementar obtencion de precio actual en EUR, cache local y manejo de fallos/timeout. IA acelera cliente HTTP, adaptadores y mocks. | Servicio de precios operativo | Se puede consultar precio por carta y persistir `current_price_eur`, `previous_price_eur` y `fetched_at` | 1.4, 1.3 | 9h | 4h |
| 2.4 | Calculo de variacion de precio | Owner: Dev. Inputs: mvp-spec.md. Implementar logica para calcular variacion porcentual y actualizar `price_timestamp`. IA acelera pruebas de borde y utilidades puras. | Modulo de pricing y variacion | La app calcula correctamente subida/bajada y cubre casos de precio previo nulo o cero | 2.3 | 4h | 2h |

**Subtotal fase 2:** Humano **30h** | Humano+IA **13h**

### Fase 3 - Flujos principales de producto

**Objetivo:** construir las pantallas y flujos MVP priorizando navegador: inventario, alta de cartas, detalle, exploracion de sets y cartas.

| # | Tarea | Descripcion | Entregable | Criterio de aceptacion | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 3.1 | Pantalla de inventario | Owner: Dev. Inputs: mvp-spec.md. Implementar listado de cartas del usuario con cantidad, estado, precio guardado, variacion y valor total. IA acelera maquetacion y wiring con store/query. | Pantalla `Mis cartas` funcional | El usuario visualiza su inventario, filtra por set y busca por nombre | 1.3, 2.4 | 8h | 3h |
| 3.2 | Flujo de agregar carta | Owner: Dev. Inputs: mvp-spec.md. Implementar buscador con autocompletado, seleccion de carta, seleccion de cantidad/estado y persistencia en inventario. IA acelera formularios, validaciones y componentes de lista. | Pantalla/modal de alta de carta | Se puede buscar una carta del catalogo y guardarla en inventario, sumando cantidad si ya existe | 2.1, 2.2, 2.3 | 10h | 4h |
| 3.3 | Detalle de carta de inventario | Owner: Dev. Inputs: mvp-spec.md. Implementar vista detalle con imagen, metadatos, precio guardado, precio actual, variacion y accion de refresco. IA acelera binding UI y estados de carga/error. | Pantalla de detalle de carta | El detalle muestra variacion correcta y permite refrescar precio bajo demanda | 2.4, 3.1 | 8h | 3h |
| 3.4 | Explorador de sets y cartas | Owner: Dev. Inputs: product-summary.md, mvp-spec.md. Implementar listado de sets, vista de cartas del set e indicador de posesion en inventario. IA acelera componentes reutilizables y marcado responsive. | Pantallas de catalogo por set | El usuario puede recorrer sets, buscar cartas dentro de un set y ver si ya las posee | 2.1, 2.2, 1.3 | 10h | 4h |
| 3.5 | Edicion y borrado de inventario | Owner: Dev. Inputs: mvp-spec.md. Implementar edicion de cantidad/estado y borrado de carta del inventario. IA acelera formularios y pruebas de reglas CRUD. | CRUD de inventario completo | Se puede editar cantidad/estado y eliminar una carta sin inconsistencias | 3.1 | 5h | 2h |

**Subtotal fase 3:** Humano **41h** | Humano+IA **16h**

### Fase 4 - Offline, calidad y cierre MVP

**Objetivo:** asegurar comportamiento offline parcial, robustez funcional en navegador y un nivel de calidad suficiente para demo o uso real.

| # | Tarea | Descripcion | Entregable | Criterio de aceptacion | Deps | Humano | Humano+IA |
|---|---|---|---|---|---|---:|---:|
| 4.1 | Estrategia offline parcial | Owner: Dev. Inputs: product-summary.md, mvp-spec.md, tech-stack.md. Implementar lectura offline de inventario, catalogo cacheado y ultimo precio conocido, con deteccion de conectividad. IA acelera wiring de estados offline y pruebas de regresion. | Soporte offline MVP | Sin conexion se puede consultar inventario y ultimo precio conocido; acciones online muestran feedback adecuado | 3.1, 3.3, 3.4 | 9h | 4h |
| 4.2 | Suite de tests unitarios | Owner: Dev. Inputs: todas las specs. Cubrir calculo de variacion, repositorios, servicios tcgdex/JustTCG y reglas de inventario. IA acelera generacion base de casos y fixtures. | Suite de unit tests | Cobertura suficiente en logica critica y tests ejecutan de forma estable en local | 1.2, 2.4, 3.5 | 8h | 3h |
| 4.3 | Suite de tests de integracion | Owner: Dev. Inputs: mvp-spec.md. Cubrir inventario, alta de cartas, refresco de precio, explorador y flujo offline principal en navegador. IA acelera setup de escenarios, mocks y asserts repetitivos. | Tests de integracion principales | Los flujos criticos del MVP pasan en navegador con mocks controlados | 1.2, 3.2, 3.3, 3.4, 4.1 | 10h | 5h |
| 4.4 | Pulido responsive y hardening | Owner: Dev. Inputs: todas las specs. Ajustar UI web, estados vacios, errores, loading, mensajes offline y rendimiento basico. IA acelera copy/UI states y limpieza final. | MVP listo para demo y uso real | Flujos criticos funcionan sin bloqueos, UI responde correctamente en navegador y estados de error estan cubiertos | 4.1, 4.2, 4.3 | 6h | 3h |

**Subtotal fase 4:** Humano **33h** | Humano+IA **15h**

## Ruta critica

1. **1.1 Inicializar proyecto base**
2. **1.3 Definir esquema local y repositorios**
3. **1.4 Definir clientes de integracion**
4. **2.1 Ingesta inicial de sets y cartas**
5. **2.3 Integracion de precios JustTCG**
6. **2.4 Calculo de variacion de precio**
7. **3.1 Pantalla de inventario**
8. **3.2 Flujo de agregar carta**
9. **3.3 Detalle de carta de inventario**
10. **4.1 Estrategia offline parcial**
11. **4.3 Suite de tests de integracion**
12. **4.4 Pulido responsive y hardening**

## Registro de riesgos

| Riesgo | Probabilidad | Impacto | Mitigacion |
|---|---|---|---|
| JustTCG no cubre todos los casos necesarios de precio o cambia su formato de respuesta | Media | Alta | Encapsular el cliente desde el inicio, usar mocks de desarrollo y mantener adaptadores aislados del dominio. |
| Dificultad para mapear cartas entre tcgdex y JustTCG | Alta | Alta | Definir una capa de normalizacion y pruebas de matching temprano en fase 2. Si es necesario, mantener tabla de equivalencias local. |
| Rendimiento pobre al cargar catalogo completo en navegador | Media | Media | Persistencia en SQLite, busqueda local indexada y renderizado incremental/listas virtualizadas cuando sea necesario. |
| Expo web presenta diferencias frente a movil en componentes o estilos | Media | Media | Priorizar navegador desde el dia 1 y usar componentes compatibles con Expo Web. |
| Cobertura de tests amplia extiende el calendario del MVP | Alta | Media | Mantener foco en modulos y flujos criticos; evitar tests superficiales de presentacion. |
| Futuro paso a multiusuario obliga a reubicar parte de la logica de datos | Media | Media | Mantener repositorios y servicios desacoplados, con dominio independiente del almacenamiento local. |

## Resumen de estimaciones

| Fase | Humano | Humano+IA |
|---|---:|---:|
| Fase 1 - Fundacion tecnica | 27h | 10h |
| Fase 2 - Datos, catalogo e integraciones | 30h | 13h |
| Fase 3 - Flujos principales de producto | 41h | 16h |
| Fase 4 - Offline, calidad y cierre MVP | 33h | 15h |
| **Total** | **111h (~14 dias)** | **51h (~6.5 dias)** |

## Proximos pasos

1. Inicializar el proyecto Expo con soporte web prioritario y dejar configurado Vitest + React Testing Library.
2. Probar manualmente la viabilidad de los endpoints y el mapeo de datos entre tcgdex.dev y JustTCG antes de construir UI compleja.
3. Implementar primero la capa local de datos (SQLite + Drizzle) y los servicios de integracion para desbloquear todos los flujos posteriores.