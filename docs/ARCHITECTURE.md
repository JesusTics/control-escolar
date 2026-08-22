# Arquitectura — Plataforma de Control Escolar

> Estado: proyecto nuevo, sin código todavía. Este documento se irá llenando
> conforme se tomen decisiones concretas de implementación.
> La fuente de verdad de principios y decisiones no negociables es [/CLAUDE.md](../CLAUDE.md).

## Bounded contexts

_Pendiente — se documentará cada bounded context (Alumnos, Calificaciones,
Asistencia, Comunicacion) conforme se implemente, con sus puertos
(interfaces) y adaptadores concretos._

### Identidad/Roles

Alcance actual (mínimo): login con email + contraseña, alta del primer
plantel + perfil de un usuario nuevo, sesión protegida vía middleware.
Explícitamente fuera de este alcance: invitar usuarios adicionales a un
plantel existente, gestión de roles posterior al alta inicial.

**Auth**: Supabase Auth con email + contraseña (no magic link) — más
predecible para el perfil de usuario administrativo/docente no técnico que
es el público objetivo del producto (ver CLAUDE.md sección 7).

**Casos de uso** (`src/modules/identidad/casos-uso/`): `iniciar-sesion`,
`cerrar-sesion`, `registrar-plantel-inicial`, `obtener-perfil-actual`. Cada
uno recibe el cliente de Supabase ya instanciado como parámetro (inyectado
desde el Server Action/Server Component que lo invoca) en vez de crearlo
internamente, para quedar testeables sin mockear módulos — aplica aquí el
criterio de hexagonal ligero de ADR-0001 (hay integración externa real:
Supabase Auth).

**Alta del primer plantel — problema del huevo y la gallina**: las
políticas RLS de `perfiles`/`planteles` (`perfiles_select_propio`,
`planteles_select_propio` vía `plantel_id_actual()`) asumen que el usuario
ya tiene una fila en `perfiles`. Un usuario recién registrado en Supabase
Auth todavía no la tiene, así que no hay forma de insertarla desde el
cliente con el rol `authenticated` normal sin abrir una política de
`INSERT` sin restricciones en `planteles`/`perfiles` — lo que permitiría a
cualquier usuario autenticado crear planteles arbitrarios o perfiles con
rol distinto al de la alta inicial.

Se resolvió con una función Postgres `security definer`,
`crear_plantel_y_perfil_inicial(p_nombre_plantel, p_nombre_completo)`
(migración `supabase/migrations/20260822075713_alta_inicial_identidad.sql`),
invocada por RPC desde el caso de uso `registrar-plantel-inicial`. La
función valida `auth.uid()` y que el usuario no tenga perfil todavía, y
agrupa ambos INSERTs en una transacción. Se evitó deliberadamente:

- **`service_role` en el código de la app**: se salta RLS por completo y
  viviría embebido en el proceso de Next.js — prohibido explícitamente por
  CLAUDE.md 4.3.
- **Políticas de `INSERT` abiertas** en `perfiles`/`planteles`: permitirían
  a cualquier usuario autenticado crear filas arbitrarias, no solo su alta
  inicial.

La función `security definer` queda acotada a esa única operación
("crear mi primer plantel y perfil"), con sus propias validaciones, en vez
de otorgar privilegios amplios al proceso de la app.

**Caso borde sin resolver todavía**: si el proyecto de Supabase tiene
confirmación de email activada (comportamiento por defecto), `auth.signUp`
no deja sesión activa de inmediato, así que el RPC de alta (que requiere
`auth.uid()`) no se puede llamar en ese momento. El flujo actual solo
informa al usuario ("revisa tu correo para confirmar tu cuenta") pero no
retoma automáticamente la creación del plantel/perfil cuando el usuario
confirma e inicia sesión después — `/dashboard` detecta este estado
(sesión válida sin perfil) y muestra un mensaje en vez de fallar o entrar
en loop de redirects, pero no hay todavía un flujo de "completar
onboarding". Pendiente de decisión en una sesión futura.

**Sesión SSR**: `src/lib/supabase/client.ts` (browser, `createBrowserClient`
de `@supabase/ssr`), `src/lib/supabase/server.ts` (Server
Components/Actions, cookies de `next/headers`) y `src/lib/supabase/middleware.ts`
+ `middleware.ts` en la raíz (refresco de sesión en cada request) siguen el
patrón oficial de `@supabase/ssr` para Next.js App Router, de modo que la
sesión se comparte de forma consistente entre servidor y cliente vía
cookies en vez de vivir solo en `localStorage`.

## Modelo de datos

Fundación multi-tenant, definida en
`supabase/migrations/20260822074551_fundacion_multitenant.sql`. Es la base
mínima a la que cualquier RLS futura de un módulo de negocio (Alumnos,
Calificaciones, etc.) referenciará vía `plantel_id`.

### `public.planteles`

Raíz de tenant — una fila por institución/plantel de la red.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `nombre` | `text` | Obligatorio |
| `created_at` | `timestamptz` | Default `now()` |

RLS habilitada. Política `planteles_select_propio`: un usuario autenticado
solo puede ver el plantel al que pertenece (`id = plantel_id_actual()`).

### `public.perfiles`

Vincula `auth.users` (Supabase Auth) con el plantel y rol del usuario dentro
de la plataforma. Toda tabla de negocio futura con `plantel_id` depende,
indirectamente, de esta tabla para resolver el tenant del usuario actual.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | Referencia `auth.users(id)`, `on delete cascade` |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_perfiles_plantel_id`) por ser columna de política RLS |
| `rol` | `text` | `not null`, `check` restringido a `alumno`, `docente`, `administrativo`, `oficina_central` |
| `nombre_completo` | `text` | Obligatorio |
| `created_at` | `timestamptz` | Default `now()` |

RLS habilitada. Política `perfiles_select_propio`: un usuario solo puede ver
su propio perfil (`id = auth.uid()`).

### Función `public.plantel_id_actual()`

Función `security definer`, `stable`, en SQL puro. Devuelve el `plantel_id`
del perfil del usuario autenticado actual (`auth.uid()`). Es el mecanismo
central para escribir políticas RLS de futuras tablas de negocio sin
duplicar el `select ... from perfiles where id = auth.uid()` en cada
política.

### Huecos conocidos (marcados `TODO` en la migración, no resueltos aún)

- No hay políticas de `INSERT`/`UPDATE` en `perfiles` ni `planteles` —
  todavía no existe un caso de uso de alta de plantel/usuario.
- No está cubierto el caso de `oficina_central` viendo varios planteles de
  la misma red — corresponde a la oleada de "red de planteles", no a esta
  fundación mínima.

## Decisiones técnicas

_Pendiente — decisiones relevantes se documentan como ADR en `/docs/adr/`._

## Diagrama de capas

_Pendiente._
