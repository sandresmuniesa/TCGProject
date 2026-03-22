# Tech Stack — Pokemon TCG Collection Manager

## Resumen ejecutivo

Se recomienda una arquitectura **client-only** para el MVP basada en **Expo (React Native)** como frontend único para web y móvil, sin backend propio en esta fase. La persistencia local se gestiona con **expo-sqlite**, las consultas de API se cachean mediante **TanStack Query**, y el estado global con **Zustand**. Esta combinación permite entregar una app funcional en web, iOS y Android desde un único codebase, con soporte offline nativo, integración directa con tcgdex.dev y JustTCG, y una base limpia para incorporar autenticación, sincronización en la nube y escaneo por cámara en fases posteriores sin reescribir el núcleo.

---

## Drivers de decisión

Extraídos de `product-summary.md` y `mvp-spec.md`:

- **Web + móvil obligatorio**: el usuario necesita acceso desde navegador y desde el teléfono.
- **Navegador como plataforma prioritaria de desarrollo**: la primera validación y el ciclo principal de pruebas deben ocurrir en web.
- **Single-user sin autenticación en MVP**: no se justifica un backend propio ni infraestructura de server.
- **Offline parcial**: el inventario y los últimos precios deben ser consultables sin conexión.
- **Dos APIs externas**: tcgdex.dev para catálogo (gratuita, sin clave) y JustTCG para precios.
- **Persistencia local estructurada**: búsqueda por nombre, filtro por set, relación entre inventario y catálogo.
- **Velocidad al mercado**: MVP enfocado, sin over-engineering.
- **Cobertura de calidad explícita**: el MVP debe incluir tests unitarios e integración.
- **Roadmap exige escalar**: fase 2 incluye cámara, alertas push, multiusuario y sync en la nube.

---

## Stack recomendado

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| Frontend (web + móvil) | Expo (React Native) | Único codebase para web, iOS y Android. Ecosistema maduro, soporte offline nativo, cámara disponible en fase 2 sin cambiar stack. |
| Navegación | Expo Router | Basado en sistema de ficheros, soporta web y móvil, compatible con deep linking futuro. |
| Estado global | Zustand | Ligero, sin boilerplate, suficiente para MVP sin complejidad de Redux. |
| Cache y llamadas API | TanStack Query | Gestión automática de cache, stale-while-revalidate, estados de carga y error. Ideal para tcgdex y JustTCG. |
| Base de datos local | expo-sqlite | SQL relacional en local, soporta queries complejas (filtro por set, búsqueda por nombre), funciona offline. |
| ORM | Drizzle ORM | Type-safe, compatible con expo-sqlite, migraciones declarativas. |
| Estilo | NativeWind (Tailwind CSS para RN) | Clases de Tailwind en componentes React Native, misma sintaxis en web y móvil. |
| API Catálogo | tcgdex.dev REST API | Gratuita, sin clave, catálogo completo de sets y cartas. |
| API Precios | JustTCG | Fuente de precios en EUR para el MVP. |
| Testing | Vitest + React Testing Library | Cobertura rápida de tests unitarios e integración para lógica, hooks y pantallas. |
| Build y distribución | Expo EAS Build | Generación de APK/IPA en la nube sin configuración nativa local. |
| Deploy web | Vercel | Export estático de Expo Web, despliegue gratuito y sencillo. |

---

## Detalle por capa

### Frontend — Expo (React Native)

**Opciones consideradas:**

| Opción | Pros | Contras |
|--------|------|---------|
| Expo (React Native) | Un codebase para web + iOS + Android. Ecosistema enorme. Cámara, offline, push notifications disponibles en fase 2 sin cambiar stack. | Rendimiento ligeramente inferior a nativo puro en apps muy complejas. |
| Flutter | Rendimiento excelente, un codebase, buen soporte offline. | Curva de aprendizaje de Dart. Ecosistema más pequeño para integraciones TCG específicas. |
| Next.js (web) + React Native (móvil) | Máxima flexibilidad por plataforma. | Dos codebases, el doble de mantenimiento, mayor coste de desarrollo. |

**Decisión: Expo (React Native)**

Justificación: En un MVP de usuario único sin backend, el mayor riesgo es fragmentar esfuerzo entre dos codebases. Expo resuelve web y móvil desde el mismo código, y su ecosistema cubre exactamente las necesidades del roadmap: `expo-camera` para fase 2, `expo-notifications` para alertas push, y `expo-sqlite` para offline. El rendimiento de React Native es más que suficiente para una app de catálogo/inventario.

---

### Backend

**Opciones consideradas:**

| Opción | Pros | Contras |
|--------|------|---------|
| Sin backend (client-only) | Cero coste, cero infraestructura, máxima velocidad al mercado. | No escala a multiusuario sin refactoring. |
| Supabase (BaaS) | Auth, base de datos y sync incluidos desde el día 1. | Sobreengineering para un MVP single-user local. |
| Node.js + Express propio | Control total. | Requiere hosting, coste, tiempo de desarrollo adicional. |

**Decisión: Sin backend en MVP**

Justificación: El MVP es single-user con persistencia local. Las dos APIs externas (tcgdex y JustTCG) se consumen directamente desde el cliente. No hay datos que necesiten servidor. La arquitectura client-only elimina costes y complejidad mientras el producto valida su utilidad.

Para fase 2, **Supabase** es la opción natural: se integra con React Native, ofrece auth, base de datos PostgreSQL en la nube y realtime, y permite migrar el esquema SQLite local con cambios mínimos.

---

### Base de datos local — expo-sqlite + Drizzle ORM

**Opciones consideradas:**

| Opción | Pros | Contras |
|--------|------|---------|
| expo-sqlite | SQL relacional, queries complejas, funciona offline, maduro. | Requiere ORM o queries manuales. |
| AsyncStorage | Muy simple, cero configuración. | Key-value puro, no soporta búsqueda ni filtrado eficiente sobre miles de cartas. |
| MMKV | Extremadamente rápido para key-value. | No relacional, inadecuado para filtros por set o búsqueda por nombre sobre catálogo completo. |

**Decisión: expo-sqlite + Drizzle ORM**

Justificación: El catálogo de tcgdex puede contener miles de cartas. La spec requiere filtrar por set, buscar por nombre y relacionar inventario con catálogo. Solo una base de datos relacional local resuelve esto eficientemente. Drizzle ORM añade tipado seguro y migraciones declarativas sin overhead.

**Esquema inicial (tablas):**

```sql
-- Catálogo cacheado de tcgdex
cards (id, set_id, number, name, image_url, fetched_at)
sets  (id, name, logo_url, total_cards, fetched_at)

-- Inventario personal
inventory (id, card_id, quantity, price_eur, price_timestamp, added_at)

-- Cache de precios de JustTCG
price_cache (card_id, current_price_eur, previous_price_eur, fetched_at)
```

---

### Estado global — Zustand

**Decisión: Zustand**

Ligero y sin boilerplate. Suficiente para gestionar estado de UI (filtros activos, carta seleccionada, estado offline). Se complementa con TanStack Query para todo lo que tiene que ver con datos asíncronos y cache de API.

---

### Cache y llamadas API — TanStack Query

**Decisión: TanStack Query (React Query)**

Gestiona automáticamente cache de respuestas de tcgdex y JustTCG, estados de carga, errores, y revalidación. Simplifica enormemente el soporte offline parcial: datos ya cargados quedan en cache y se sirven sin conexión. Al recuperar conexión, revalida automáticamente.

---

### Testing

**Decisión: Vitest + React Testing Library**

Justificación: el MVP exige cobertura de tests unitarios e integración. Vitest ofrece ejecución rápida y buena ergonomía en ecosistema React, mientras React Testing Library permite validar hooks, componentes y flujos principales sin sobrecargar el setup. Para navegador, este stack acelera el feedback loop durante desarrollo.

---

### Integraciones externas

#### tcgdex.dev

- API REST pública, sin autenticación, sin coste.
- Endpoints clave:
  - `GET /sets` — listado de todos los sets.
  - `GET /sets/{id}/cards` — cartas de un set.
  - `GET /cards/{id}` — detalle de carta.
- Estrategia: descarga completa al primer inicio, almacenada en SQLite. Actualización manual posterior.

#### JustTCG

- Fuente de precios elegida para el MVP.
- Estrategia: llamada bajo demanda al entrar al detalle o al pulsar "Refrescar precio". Resultado cacheado en `price_cache`.
- Riesgo abierto a validar en implementación: disponibilidad, límites de uso y formato exacto de respuesta.

---

### Deployment e infraestructura

#### Móvil — Expo EAS Build

- Genera APK (Android) e IPA (iOS) en la nube sin configuración nativa local.
- En MVP: distribución via Expo Go para pruebas, o APK directo para Android.
- En fase 2: publicación en Play Store / App Store via EAS Submit.

#### Web — Vercel

- `expo export --platform web` genera un build estático.
- Deploy en Vercel: gratuito para proyectos personales, CDN global, HTTPS automático.
- Alternativa equivalente: Netlify.
- Plataforma prioritaria para desarrollo, QA y validación inicial del MVP.

---

## Soporte al roadmap

### Fase 2 — Cámara, alertas, multiusuario

| Feature | Soporte en stack actual |
|---------|------------------------|
| Escaneo por cámara | `expo-camera` + `expo-barcode-scanner` disponibles sin cambiar stack. |
| Alertas automáticas de precio | `expo-notifications` para push. Requiere añadir backend (Supabase Functions o similar) para scheduling. |
| Cuentas multiusuario | Añadir Supabase Auth. Migrar SQLite local a PostgreSQL en Supabase con cambios mínimos en Drizzle. |
| Sincronización en la nube | Supabase Realtime. TanStack Query sigue siendo válido en capa cliente. |

### Fase 3 — Wishlist, recomendaciones

- La arquitectura relacional en SQLite (migrable a PostgreSQL) soporta estas entidades sin cambios estructurales en el stack.
- Lógica de recomendaciones puede añadirse sin cambiar frontend (cálculos en Supabase Functions o cliente).

---

## Trade-offs aceptados

| Trade-off | Razón para aceptarlo |
|-----------|----------------------|
| Sin backend propio en MVP | El producto es single-user local. Añadirlo ahora es sobreengineering sin validar valor primero. |
| React Native vs nativo puro | El rendimiento de React Native es suficiente para una app de catálogo/inventario. El ahorro en tiempo de desarrollo supera la diferencia de rendimiento. |
| API de precios externa puede tener límites o cambios | Aceptable en MVP siempre que la integración se encapsule y exista posibilidad de mockear respuestas para desarrollo y tests. |
| Expo en lugar de bare React Native | Expo cubre todas las necesidades del roadmap (cámara, push, sqlite). Eject a bare solo si aparece una limitación real. |
| No PWA offline completo | Expo Web tiene soporte offline limitado comparado con una PWA nativa. Aceptable porque el caso de uso offline principal es móvil. |

---

## Out of scope para MVP

- Autenticación y cuentas de usuario → Fase 2 (Supabase Auth).
- Sincronización en la nube → Fase 2 (Supabase Realtime).
- Backend propio → Fase 2 si Supabase no cubre las necesidades.
- Escaneo por cámara → Fase 2 (expo-camera).
- Alertas push automáticas → Fase 2 (expo-notifications + backend scheduling).
- Historia de precios con gráficos → Fase 3.
- Wishlist y recomendaciones → Fase 3.
- Publicación en App Store / Play Store → Fase 2 (EAS Submit).
