# Registro de incidencias tecnicas (fuera de roadmap)

## Objetivo

Este documento sirve para registrar problemas tecnicos detectados durante desarrollo/QA que no estaban contemplados como tareas del plan por fases.

Uso recomendado:
- Registrar la incidencia con evidencia minima.
- Proponer mitigaciones tecnicas viables.
- Decidir si se trata como hotfix, deuda tecnica o tarea futura.

Estados sugeridos:
- `Nuevo`
- `Analizando`
- `Mitigacion en curso`
- `Resuelto`
- `Descartado`

Prioridad sugerida:
- `P0` bloqueante
- `P1` alta
- `P2` media
- `P3` baja

---

## Plantilla de incidencia

```md
### [ISSUE-XXX] Titulo corto
- Estado: Nuevo
- Prioridad: P2
- Fecha deteccion: YYYY-MM-DD
- Detectado en: web | android | ios | test
- Relacion con roadmap: Fuera de fase / afecta F?-T?

#### Contexto
Descripcion breve del problema y cuando ocurre.

#### Evidencia
Logs, errores, metrica, reproducibilidad.

#### Impacto
Que rompe o degrada (UX, rendimiento, coste API, estabilidad, etc.).

#### Hipotesis tecnica
Causas probables.

#### Opciones de solucion
1) Opcion A
2) Opcion B
3) Opcion C

#### Recomendacion
Solucion recomendada con razon.

#### Criterio de cierre
Como verificamos que quedo resuelto.
```

---

## Incidencias activas

### [ISSUE-001] Ingesta inicial de cartas lenta y con rechazos de API
- Estado: Nuevo
- Prioridad: P1
- Fecha deteccion: 2026-03-21
- Detectado en: web
- Relacion con roadmap: Fuera de fase (impacta operativa de F2-T2)

#### Contexto
Durante la descarga inicial de cartas por set, el proceso es lento y en algunos casos la API rechaza llamadas.

#### Evidencia
- La estrategia actual hace una llamada por set (`/sets/{id}`), lo que implica un volumen alto de requests cuando hay muchos sets.
- Se reportan rechazos de la API durante el proceso de ingesta.

#### Impacto
- Tiempo de bootstrap elevado del catalogo.
- Riesgo de catalogo incompleto por fallos intermitentes.
- Mala experiencia en primer uso.

#### Hipotesis tecnica
- Alto numero de requests consecutivas hacia TCGDex.
- Posible limitacion de rate limit o proteccion anti-abuso del proveedor.
- Falta de estrategia de reintentos/backoff y reanudacion parcial.

#### Opciones de solucion
1. Introducir control de concurrencia + backoff exponencial + jitter + reintentos por set.
2. Persistir progreso incremental por set (estado `pendiente/en_progreso/completado/error`) para reanudar y no repetir todo.
3. Implementar cola de sincronizacion por lotes con pausas entre ventanas de requests.
4. Evaluar endpoint bulk de cartas (si TCGDex lo permite) para reducir numero de llamadas.
5. Cachear snapshots/versionado de catalogo y aplicar actualizaciones diferenciales en vez de full bootstrap.
6. Crear modo de "bootstrap progresivo" (primero sets + top N sets, luego resto en segundo plano).

#### Recomendacion
Aplicar en este orden:
1. Mitigacion rapida: concurrencia limitada (2-4), retry con backoff+jitter y timeout por request.
2. Robustez: persistencia de progreso por set y reanudacion segura.
3. Optimizacion: validar ruta bulk/diferencial para reducir llamadas totales.

#### Criterio de cierre
- No hay rechazos no controlados en una sincronizacion completa.
- La sincronizacion puede reanudarse tras fallo de red sin reiniciar desde cero.
- El tiempo total de bootstrap baja de forma medible respecto al baseline actual.

### [ISSUE-002] Filtro de sets no usable con catalogo grande
- Estado: Resuelto
- Prioridad: P2
- Fecha deteccion: 2026-03-21
- Fecha resolucion: 2026-03-23
- Detectado en: web
- Relacion con roadmap: Fuera de fase (detectado durante F3-T3)

#### Contexto
El filtro de sets en la pantalla de seleccion de carta muestra todos los sets en una sola linea horizontal. Con un volumen alto de sets (aprox. 200), parte de los chips queda fuera de pantalla, incluyendo desplazamiento fuera del viewport por la izquierda.

#### Evidencia
- El control actual renderiza los sets como chips en un `ScrollView` horizontal.
- Con muchos sets, la navegacion visual resulta incompleta y poco usable en pruebas.
- Se decide no corregir en este momento porque no bloquea las pruebas funcionales actuales.

#### Impacto
- Dificulta encontrar sets concretos en el flujo de alta desde catalogo.
- Reduce usabilidad y eficiencia del filtrado en catalogos grandes.

#### Hipotesis tecnica
- El patron de chips horizontales no escala bien para listas de sets extensas.
- Falta una interfaz de seleccion compacta y navegable para volumen alto de opciones.

#### Opciones de solucion
1. Sustituir chips horizontales por selector en pop-up/modal con buscador interno.
2. Mantener chips visibles para favoritos/recientes y mover listado completo a pop-up.
3. Implementar selector de sets con seleccion multiple y resumen en el input principal.

#### Recomendacion
Implementar un selector en pop-up con buscador y seleccion multiple de sets. Esta opcion mejora escalabilidad del filtro, evita desbordes de layout y habilita combinaciones de sets para consultas mas flexibles.

#### Criterio de cierre
- El filtro de sets es completamente usable con >200 sets sin elementos fuera de viewport.
- El usuario puede seleccionar uno o varios sets desde pop-up sin degradacion de rendimiento perceptible.
- El estado de filtros seleccionados se refleja correctamente en los resultados del catalogo.

### [ISSUE-003] Imagenes de cartas no visibles en UI
- Estado: Resuelto
- Prioridad: P2
- Fecha deteccion: 2026-03-21
- Fecha resolucion: 2026-03-23
- Detectado en: web
- Relacion con roadmap: Fuera de fase (detectado durante pruebas de F3-T3)

#### Contexto
En las pantallas de inventario y seleccion de carta del catalogo, las miniaturas no se muestran aunque la tarjeta aparece en resultados.

#### Evidencia
- El cliente de tcgdex ya mapea `image` a `imageUrl` en `fetchCardsBySet`.
- La UI ya renderiza `<Image source={{ uri: imageUrl }}>` cuando `imageUrl` existe.
- Verificacion manual del endpoint de ejemplo (`https://assets.tcgdex.net/en/base/base1/1`) devuelve respuesta `200`.

#### Impacto
- Baja calidad visual del flujo de alta y del inventario.
- Menor capacidad de identificar rapidamente la carta correcta.

#### Hipotesis tecnica
- Datos de cache/localStorage o SQLite sin `imageUrl` por sincronizacion previa incompleta o antigua.
- Inconsistencia entre datos ya persistidos y el mapeo actual de tcgdex.
- Posible necesidad de normalizar URL de imagen (formato final/extension) antes de pintar.

#### Opciones de solucion
1. Forzar re-sincronizacion de cartas cuando `imageUrl` sea nulo en registros existentes.
2. Invalidar version de cache local (`v2`) para regenerar catalogo con `imageUrl` actualizado.
3. Añadir fallback de normalizacion de URL de imagen previo a render.

#### Recomendacion
Aplicar invalidacion de cache versionada + re-sincronizacion incremental para rellenar `imageUrl` faltante, evitando borrar toda la base cuando no sea necesario.

#### Criterio de cierre
- Se muestran miniaturas en resultados de catalogo y en inventario para cartas que tienen imagen en tcgdex.
- Registros persistidos antiguos se corrigen sin romper datos funcionales del inventario.
- No aparecen errores de carga de imagen en consola durante navegacion normal.

### [ISSUE-004] Configuracion de API key de JustTCG no documentada en runtime
- Estado: Resuelto
- Prioridad: P1
- Fecha deteccion: 2026-03-21
- Detectado en: web
- Relacion con roadmap: Fuera de fase (afecta operativa de F2-T4 y F3-T5)

#### Contexto
La obtencion de precios falla cuando JustTCG requiere autenticacion por API key y no existe una configuracion explicita de entorno para ejecutarlo en local.

#### Evidencia
- El flujo de precios depende de variables de entorno para URL/API key.
- Sin API key configurada, la API puede responder con error de autenticacion y no devuelve precio.
- No existe guia operativa visible en el proyecto para levantar entorno local con credenciales.

#### Impacto
- Precio no disponible en alta de carta y detalle.
- Variacion de precio sin datos actuales.
- Pruebas manuales incompletas en entorno local.

#### Hipotesis tecnica
- Faltan variables de entorno requeridas en la sesion de ejecucion de Expo.
- Configuracion local no persistida entre reinicios del servidor.

#### Opciones de solucion
1. Documentar setup local de variables de entorno para JustTCG (URL + API key).
2. Añadir plantilla de variables de entorno para onboarding rapido.
3. Validar en arranque si falta API key y mostrar advertencia de configuracion.

#### Recomendacion
Aplicar documentacion minima + validacion de entorno para detectar ausencia de API key antes de ejecutar flujos de precio.

#### Criterio de cierre
- El equipo puede configurar URL/API key en menos de 2 minutos siguiendo guia del repo.
- Los flujos de precio devuelven datos con credenciales validas.
- Si falta API key, la app informa claramente el motivo.

### [ISSUE-005] Correlacion incorrecta de cartas entre TCGDex y JustTCG
- Estado: Nuevo
- Prioridad: P1
- Fecha deteccion: 2026-03-21
- Detectado en: web
- Relacion con roadmap: Fuera de fase (afecta F2-T4, F3-T5)

#### Contexto
El sistema busca precios en JustTCG usando el nombre y numero de carta obtenidos desde TCGDex. Sin filtro por set, la busqueda puede devolver cartas homonimas de sets distintos, produciendo precios incorrectos o ausentes.

#### Evidencia
- Los IDs de set de TCGDex (ej. `ecard1`) no son compatibles con los de JustTCG, por lo que el parametro `set` fue eliminado del query.
- La busqueda actual solo usa `game: "Pokemon"`, `query: cardName` y `number: cardNumber`.
- Cartas con el mismo nombre y numero pero en sets distintos (ej. "Pikachu #124" en varios sets) pueden causar coincidencias cruzadas.
- Los IDs de carta de TCGDex (ej. `ecard1-124`) tampoco son compatibles con JustTCG.

#### Impacto
- Precios obtenidos pueden corresponder a una edicion distinta de la carta registrada en inventario.
- La variacion de precio calculada seria incorrecta.
- En casos donde la carta correcta no aparece en resultados, no se muestra precio aunque exista.

#### Hipotesis tecnica
- No existe un identificador compartido entre ambas APIs.
- La unica clave cruzada fiable seria el nombre canonico + numero + nombre de set, pero el nombre de set tampoco esta garantizado como identico entre ambas fuentes.
- JustTCG podria exponer un identificador de set propio que habria que mapear manualmente contra los IDs de TCGDex.

#### Opciones de solucion
1. Construir una tabla de mapeo manual o semi-automatica entre IDs de set de TCGDex y JustTCG, y restablecer el filtro `set` en la query.
2. Usar `set_name` de la respuesta de JustTCG como heuristica para desambiguar cuando hay multiples resultados para el mismo nombre+numero.
3. Implementar un sistema de puntuacion de candidatos (nombre exacto + numero exacto + set_name similar) y elegir el de mayor puntuacion.
4. Priorizar el resultado cuyo `set_name` tenga mayor similitud con el nombre de set almacenado en TCGDex.
5. Exponer al usuario la ambiguedad y permitirle vincular manualmente la carta con su entrada en JustTCG.

#### Recomendacion
Combinar opciones 3 y 4: implementar un scorer de candidatos que pondere nombre exacto, numero exacto y similitud fuzzy de nombre de set. Si solo hay un resultado con nombre+numero coincidentes, usarlo directamente. Si hay varios, elegir el de mayor similitud de set_name. Registrar el ID de JustTCG elegido en cache para evitar re-evaluacion.

#### Criterio de cierre
- La carta seleccionada en JustTCG corresponde al set correcto segun los datos de TCGDex.
- No se asignan precios de ediciones erroneas a cartas del inventario.
- El mecanismo de desambiguacion es verificable via logs o datos almacenados.

---

## Decisiones

- **ISSUE-002 (2026-03-23)**: Implementado selector de sets en modal (`SetPickerModal`) con buscador interno y multi-seleccion. Reemplaza el ScrollView horizontal de chips en `add-card.tsx`. Se extendio `CatalogSearchParams` y el repositorio SQLite para aceptar `setIds: string[]`. Los resultados del catalogo filtran por uno, varios, o ningun set. 94 tests existentes pasan sin cambios. Cierre confirmado por validacion funcional del usuario (2026-03-27).
- **ISSUE-003 (2026-03-23)**: Corregida normalizacion de URL de imagen en `tcgdex-client.ts` — `buildImageUrl()` agrega `/low.webp` (245x337, webp transparente) a URLs base sin extension. Bumpeada clave de cache web de cartas a `v2` para forzar re-descarga de registros obsoletos. Agregada `healCardImageUrls()` en el repositorio (UPDATE SQL idempotente) que se ejecuta al finalizar `syncInitialCardsBySetCatalog` en plataformas nativas para corregir registros SQLite ya persistidos. 98 tests pasan.
