# Arquitectura — Plataforma de Control Escolar

> Estado: proyecto nuevo, sin código todavía. Este documento se irá llenando
> conforme se tomen decisiones concretas de implementación.
> La fuente de verdad de principios y decisiones no negociables es [/CLAUDE.md](../CLAUDE.md).

## Bounded contexts

_Pendiente — se documentará cada bounded context (Calificaciones, Asistencia,
Comunicacion) conforme se implemente, con sus puertos (interfaces) y
adaptadores concretos._

### Alumnos

Alcance actual (mínimo): alta e inscripción de un alumno y listado de
alumnos del plantel del usuario actual. Explícitamente fuera de este
alcance (sesión futura): expediente completo, edición, baja, y cualquier
dato sensible (médico, tutores) — este último requiere resolver primero
cifrado en reposo (CLAUDE.md 4.4), que no está implementado todavía.

**Casos de uso** (`src/modules/alumnos/casos-uso/`): `inscribir-alumno`,
`listar-alumnos`. Mismo patrón que Identidad/Roles: reciben el cliente de
Supabase ya instanciado como parámetro en vez de crearlo internamente. Se
aplica hexagonal ligero aquí (no CRUD puro) porque hay lógica de negocio
real: validación de campos obligatorios y unicidad de matrícula por
plantel, con traducción del error crudo de Postgres (código `23505`, y
`42501` cuando RLS rechaza el INSERT por rol) a un mensaje de negocio claro
— ver ADR-0001 sobre el criterio de cuándo aplicar hexagonal.

`inscribir-alumno` resuelve el `plantel_id` a partir de
`obtener-perfil-actual` (reutilizado de Identidad/Roles) en vez de recibirlo
del formulario, para no depender de que el cliente envíe un `plantel_id`
arbitrario — la fuente de verdad del tenant del usuario es siempre su
perfil, nunca un valor de formulario.

### Calificaciones

Alcance actual (mínimo): catálogo de materias por plantel, registro (y
corrección) de calificaciones por alumno/materia/periodo, y kardex de un
alumno con promedio general. Explícitamente fuera de este alcance (ver
instrucciones de la sesión): edición/borrado de calificaciones más allá de
re-registrar (upsert), boletas/reportes en PDF, gestión de periodos
escolares como catálogo propio (`periodo` es texto libre, ej. "2026-1"), y
permisos granulares de "solo el docente que imparte la materia puede
calificarla" (cualquier rol de staff puede, por ahora).

**Casos de uso** (`src/modules/calificaciones/casos-uso/`): `crear-materia`,
`listar-materias`, `registrar-calificacion`, `obtener-kardex-alumno`. Mismo
patrón de cliente de Supabase inyectado que Alumnos/Identidad. Se aplica
hexagonal ligero aquí de forma explícita — CLAUDE.md 4.1 usa Calificaciones
(promedios, reprobación) como el ejemplo textual de "lógica de negocio no
trivial" que justifica aislar la lógica de dominio del framework/proveedor.

**Lógica de dominio pura** (`src/modules/calificaciones/dominio/calificacion.ts`):
`NOTA_APROBATORIA = 6` (escala 0-10), `estaAprobado(calificacion)`,
`calcularPromedio(calificaciones)` (retorna `null` en arreglo vacío, nunca
divide entre cero). Sin dependencias de Supabase ni de red — testeable en
aislamiento total, cubierta por `tests/dominio/calificaciones.test.ts`
(TDD-lite en lógica crítica, CLAUDE.md sección 5).

**Decisión de diseño — upsert en vez de insert**: `registrar-calificacion`
usa `.upsert()` con `onConflict: 'alumno_id,materia_id,periodo'` en vez de
`.insert()`. Volver a capturar la misma materia/periodo para un alumno
actualiza la calificación existente en vez de fallar por violación de
unicidad — es el comportamiento esperado cuando un docente corrige una nota
ya capturada, y es explícitamente la única forma de "editar" en este alcance
(no hay un caso de uso de edición/borrado separado).

**Kardex**: `obtener-kardex-alumno` trae el alumno, sus calificaciones (con
el nombre de materia vía `select` anidado de Supabase,
`materia:materias(nombre)`), el promedio general (`calcularPromedio` sobre
todas las calificaciones del alumno) y si está aprobado en cada materia
(`estaAprobado` aplicado a la calificación individual — no hay promedio por
materia todavía, es una sola calificación por materia/periodo).

### Asistencia

Alcance actual (mínimo): asistencia diaria general del plantel — **un
registro por alumno por día**, no por materia/clase individual. Es una
simplificación consciente y razonable para el MVP, igual que en primaria/
secundaria mexicana se toma lista una vez al día (ver alcance explícito de
la sesión). Explícitamente fuera de este alcance: asistencia por materia,
reportes de tendencias, y notificaciones automáticas a padres por
inasistencia (eso corresponde al módulo Comunicación, todavía no
implementado).

**Casos de uso** (`src/modules/asistencia/casos-uso/`):
`registrar-asistencia-del-dia`, `obtener-asistencia-alumno`,
`listar-alumnos-para-captura`. Mismo patrón de cliente de Supabase inyectado
que Alumnos/Calificaciones/Identidad. Se aplica hexagonal ligero aquí de
forma explícita — CLAUDE.md 4.1 usa Asistencia, junto con Calificaciones e
Identidad/Roles, como ejemplo textual de "lógica de negocio no trivial".

`listar-alumnos-para-captura` filtra explícitamente por `estado = 'activo'`
en vez de reusar `listar-alumnos` (que lista todos los alumnos sin importar
estado, para el directorio general) — no tiene sentido tomar asistencia de
un alumno dado de baja, y ese filtro es una regla propia de este caso de
uso, no del listado general de Alumnos.

**Lógica de dominio pura** (`src/modules/asistencia/dominio/asistencia.ts`):
`calcularPorcentajeAsistencia(registros)`. Regla de negocio no obvia,
documentada en el propio código: `presente` y `retardo` cuentan como
asistencia (a favor); `ausente` cuenta en el denominador pero no a favor;
`justificado` se **excluye por completo** del cálculo (ni numerador ni
denominador) — una ausencia justificada no debería penalizar el porcentaje
del alumno, pero tampoco equivale a haber asistido. Devuelve `null` si no
hay registros no-justificados, nunca divide entre cero (mismo criterio que
`calcularPromedio` en Calificaciones). Sin dependencias de Supabase ni de
red — testeable en aislamiento total, cubierta por
`tests/dominio/asistencia.test.ts`.

**Decisión de diseño — upsert masivo en vez de insert por alumno**:
`registrar-asistencia-del-dia` recibe el arreglo completo de
`{alumno_id, estado}` de un día y hace un solo `.upsert()` con
`onConflict: 'alumno_id,fecha'` — una sola llamada de red para toda la lista,
no una petición por alumno (CLAUDE.md 7 pide explícitamente "modo
asistido/wizard para... captura masiva"). Volver a capturar la asistencia
del mismo día para el mismo alumno corrige el registro existente en vez de
fallar por violación de unicidad, mismo criterio que
`registrar-calificacion.ts` en Calificaciones — no hay un caso de uso de
edición/corrección separado, re-capturar ES la forma de corregir.

**Tabla `public.asistencias`**, definida en
`supabase/migrations/20260822190214_asistencia_diaria.sql`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_asistencias_plantel_id`) |
| `alumno_id` | `uuid` | `not null`, referencia `alumnos(id)`. Indexado (`idx_asistencias_alumno_id`) |
| `fecha` | `date` | Obligatoria |
| `estado` | `text` | `not null`, `check` restringido a `presente`/`ausente`/`retardo`/`justificado` |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |

Restricción `unique(alumno_id, fecha)` — un solo registro de asistencia por
alumno/día, es la que habilita el patrón de `upsert` masivo del caso de uso.

RLS habilitada. Tres políticas, mismo criterio de roles que
`calificaciones` (incluye `docente` en `INSERT`/`UPDATE` porque tomar
asistencia es tarea docente en la vida real, aunque hoy no exista todavía un
flujo de alta de usuarios con ese rol):

- `asistencias_select_mismo_plantel`: cualquier usuario autenticado del
  plantel puede ver las asistencias de su plantel.
- `asistencias_insert_staff_mismo_plantel` /
  `asistencias_update_staff_mismo_plantel`: solo `administrativo`,
  `oficina_central` o `docente` del mismo plantel.

**Cubierta desde el primer commit** por `tests/aislamiento-asistencia.test.ts`
(CLAUDE.md 4.3) — ver/no-ver registro de asistencia ajeno, spoofing de
`plantel_id` rechazado por RLS. Usa una fecha fija determinista
(`2026-01-15`) para que la corrida sea idempotente entre ejecuciones (el
upsert por `alumno_id,fecha` no duplica filas).

### Comunicación

Alcance actual (mínimo): **tablón de avisos interno (in-app)**, de solo alta
y lectura — no envío real de correo/SMS a padres/tutores. Es una decisión de
alcance explícita, no una simplificación temporal sin razón:

- No existen todavía datos de contacto de tutores en el sistema (bloqueados
  por CLAUDE.md 4.4 — cifrado en reposo para datos de contacto de tutores no
  está implementado), así que no hay a quién enviar un correo/SMS real
  todavía.
- Construir una interfaz `IEmailSender` hoy, sin una implementación real de
  proveedor detrás, sería exactamente la ceremonia que CLAUDE.md 4.1 dice
  evitar ("una interfaz con una sola implementación real no es arquitectura,
  es ceremonia") — y aquí ni siquiera habría una implementación real, solo un
  mock. Cuando exista un proveedor de email real que integrar, ahí sí aplica
  el criterio de CLAUDE.md 4.1 de "integración con un proveedor externo real"
  y se justifica la interfaz.
- Sin edición ni borrado de avisos — más simple y consistente con "sin
  sobreingeniería para el MVP" (CLAUDE.md 4.1). Si un aviso tiene un error,
  por ahora se publica uno nuevo corrigiéndolo.
- Sin portales diferenciados por rol todavía (el campo `dirigido_a` es
  informativo, no filtra quién puede ver el aviso) — depende de que existan
  cuentas de docente/alumno reales, y hoy solo existe el alta inicial de
  `oficina_central` vía registro (ver huecos conocidos de Identidad/Roles más
  abajo y la entrada correspondiente en `memory/CONTEXT.md`).

**Casos de uso** (`src/modules/comunicacion/casos-uso/`): `publicar-aviso`,
`listar-avisos`. Mismo patrón de cliente de Supabase inyectado que el resto
de módulos. Se trata como CRUD simple (sin capa de dominio puro separada,
a diferencia de Calificaciones/Asistencia) — no hay lógica de negocio no
trivial en este alcance (alta con dos campos obligatorios y un listado
ordenado), solo el patrón de resolver `plantel_id`/`autor_id` desde la
sesión actual en vez de confiar en el formulario, igual que en los demás
módulos.

`publicar-aviso` toma `autor_id` de `auth.getUser()` (el usuario autenticado
actual), nunca de un valor de formulario — mismo criterio que `plantel_id`
en Alumnos/Calificaciones/Asistencia. `listar-avisos` trae el nombre del
autor vía `select` anidado (`autor:perfiles(nombre_completo)`), mismo patrón
que el nombre de materia en el kardex de Calificaciones.

**Tabla `public.avisos`**, definida en
`supabase/migrations/20260822191115_avisos_tablon.sql`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_avisos_plantel_id`) |
| `autor_id` | `uuid` | `not null`, referencia `perfiles(id)` |
| `titulo` | `text` | Obligatorio |
| `contenido` | `text` | Obligatorio |
| `dirigido_a` | `text` | `not null`, default `'todos'`, `check` restringido a `todos`/`docentes`/`alumnos` |
| `created_at` | `timestamptz` | Default `now()` |

RLS habilitada. Dos políticas (sin `UPDATE`/`DELETE` — no hay caso de uso de
edición/borrado en este alcance):

- `avisos_select_mismo_plantel`: cualquier usuario autenticado del plantel
  puede ver los avisos de su plantel.
- `avisos_insert_staff_mismo_plantel`: exige `plantel_id =
  plantel_id_actual()`, `autor_id = auth.uid()` (nadie puede publicar un
  aviso a nombre de otro usuario) y rol `administrativo` u `oficina_central`
  — a diferencia de `calificaciones`/`asistencias`, no incluye `docente`
  (publicar avisos institucionales es tarea administrativa en este alcance,
  no docente).

**Cubierta desde el primer commit** por
`tests/aislamiento-avisos.test.ts` (CLAUDE.md 4.3) — ver/no-ver aviso ajeno,
spoofing de `plantel_id` rechazado por RLS. Sin restricción `unique` en la
tabla (a diferencia de `alumnos`/`materias`), así que la idempotencia del
test se logra buscando por título fijo antes de insertar, en vez de confiar
en un conflicto de unicidad.

### Identidad/Roles

Alcance actual (mínimo): login con email + contraseña, alta del primer
plantel + perfil de un usuario nuevo, sesión protegida vía middleware,
**sistema de invitaciones** para dar de alta usuarios adicionales
(docente/alumno/administrativo) a un plantel ya existente. Explícitamente
fuera de este alcance (ver diseño de la sesión de invitaciones):
portales diferenciados por rol (siguiente sesión), envío real de correo (el
link de invitación se comparte manualmente, mismo criterio que Comunicación)
y revocar/reenviar invitaciones (solo alta + aceptación + expiración pasiva).

**Auth**: Supabase Auth con email + contraseña (no magic link) — más
predecible para el perfil de usuario administrativo/docente no técnico que
es el público objetivo del producto (ver CLAUDE.md sección 7).

**Casos de uso** (`src/modules/identidad/casos-uso/`): `iniciar-sesion`,
`cerrar-sesion`, `registrar-plantel-inicial`, `obtener-perfil-actual`,
`crear-invitacion`, `listar-invitaciones`, `obtener-info-invitacion`,
`aceptar-invitacion`. Cada uno recibe el cliente de Supabase ya instanciado
como parámetro (inyectado desde el Server Action/Server Component que lo
invoca) en vez de crearlo internamente, para quedar testeables sin mockear
módulos — aplica aquí el criterio de hexagonal ligero de ADR-0001 (hay
integración externa real: Supabase Auth).

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

**Confirmación de email — flujo con y sin sesión inmediata**: si el proyecto
de Supabase tiene confirmación de email activada, `auth.signUp` no deja
sesión activa de inmediato, así que el RPC de alta (que requiere
`auth.uid()`) no se puede llamar en ese momento. Esto se resolvió sin
duplicar la lógica de alta ni pedir de nuevo `nombre_plantel`/`nombre_completo`
al usuario:

1. `src/app/registro/acciones.ts` llama `auth.signUp` guardando
   `nombre_plantel`/`nombre_completo` como *user metadata* de Supabase Auth
   (`options.data`) y pasando `options.emailRedirectTo` apuntando a
   `/auth/callback`. Esa metadata sigue disponible aunque pasen días entre el
   registro y el clic en el correo de confirmación.
2. Si `signUp` ya devuelve sesión (confirmación desactivada, como en el
   proyecto de desarrollo actual), el flujo sigue exactamente igual que
   antes: se llama `registrar-plantel-inicial` de inmediato y se redirige a
   `/dashboard`. Este camino no cambió.
3. Si no hay sesión inmediata (confirmación activada), se informa al usuario
   ("revisa tu correo") y el alta se completa después en
   `src/app/auth/callback/route.ts` — un Route Handler (no una page, porque
   no hay UI que mostrar, solo un efecto secundario y una redirección) al que
   Supabase manda al usuario tras hacer clic en el link del correo, con un
   `code` en la query string. El handler: intercambia el `code` por sesión
   (`exchangeCodeForSession`, cliente de servidor); revisa con
   `obtener-perfil-actual` si el usuario ya tiene perfil (protege contra
   doble clic en el link); si no lo tiene, lee `nombre_plantel`/
   `nombre_completo` de `user.user_metadata` y llama al mismo
   `registrar-plantel-inicial` que usa `/registro` (sin duplicar lógica); y
   redirige a `/dashboard`. Cualquier falla (código inválido/expirado,
   metadata faltante, error del RPC) redirige a `/login?error=...` con un
   mensaje legible, que `/login` muestra si el parámetro está presente.
4. `/dashboard` conserva el mensaje de "tu cuenta no tiene plantel" como red
   de seguridad (ver comentario en `src/app/dashboard/page.tsx`), pero ya no
   es el camino principal para completar el alta cuando la confirmación está
   activada — `/auth/callback` la completa antes de que el usuario llegue ahí.

Nota operativa: en el proyecto de Supabase de **desarrollo**, "Confirm
email" sigue **desactivado** por decisión explícita del usuario (no técnica)
— ver entrada correspondiente en `memory/CONTEXT.md` para los pasos de
verificación manual pendientes de correr el día que se active.

**Sesión SSR**: `src/lib/supabase/client.ts` (browser, `createBrowserClient`
de `@supabase/ssr`), `src/lib/supabase/server.ts` (Server
Components/Actions, cookies de `next/headers`) y `src/lib/supabase/middleware.ts`
+ `middleware.ts` en la raíz (refresco de sesión en cada request) siguen el
patrón oficial de `@supabase/ssr` para Next.js App Router, de modo que la
sesión se comparte de forma consistente entre servidor y cliente vía
cookies en vez de vivir solo en `localStorage`.

**Sistema de invitaciones — mismo problema del huevo y la gallina que el
alta inicial**: dar de alta un *segundo* usuario (docente, alumno, u otro
administrativo) en un plantel ya existente tiene el mismo obstáculo que el
alta del primer plantel — la persona invitada todavía no tiene fila en
`perfiles`, así que no puede pasar las políticas RLS normales para
insertarse a sí misma. Se resuelve con el mismo criterio (CLAUDE.md 4.3):
funciones `security definer` acotadas a una sola operación cada una, nunca
`service_role` en el código de la app ni políticas de `INSERT`/`SELECT`
abiertas.

**Tabla `public.invitaciones`**, definida en
`supabase/migrations/20260822191914_invitaciones_plantel.sql`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_invitaciones_plantel_id`) |
| `email` | `text` | Obligatorio — correo de la persona invitada |
| `rol` | `text` | `not null`, `check` restringido a `administrativo`/`docente`/`alumno` (sin `oficina_central` — no tiene sentido invitar a un segundo `oficina_central` en este alcance) |
| `token` | `uuid` | `not null`, único, default `gen_random_uuid()` — identifica el link público de aceptación |
| `creada_por` | `uuid` | `not null`, referencia `perfiles(id)` |
| `expira_en` | `timestamptz` | `not null`, default `now() + 7 días` |
| `usada_en` | `timestamptz` | `null` hasta que se acepta la invitación |
| `created_at` | `timestamptz` | Default `now()` |

RLS habilitada. Dos políticas, ambas restringidas a staff
(`administrativo`/`oficina_central`) del mismo plantel:

- `invitaciones_select_staff_mismo_plantel`: solo staff del plantel puede
  ver las invitaciones de su plantel — un docente/alumno no puede listar
  invitaciones ajenas ni propias por esta vía (la pantalla de aceptación usa
  el RPC público, no un `select` directo, ver abajo).
- `invitaciones_insert_staff_mismo_plantel`: exige `plantel_id =
  plantel_id_actual()`, `creada_por = auth.uid()` (nadie puede crear una
  invitación a nombre de otro usuario) y rol de staff — mismo criterio que
  `avisos_insert_staff_mismo_plantel`.

Ninguna política de `UPDATE`/`DELETE` — no hay caso de uso de
revocar/reenviar en este alcance (decisión explícita, ver diseño de la
sesión); una invitación vencida o mal enviada simplemente se vuelve a crear.

**Dos funciones `security definer`, cada una acotada a una sola operación**
(mismo criterio que `crear_plantel_y_perfil_inicial`):

- `obtener_invitacion_publica(p_token uuid)`: `language sql`, `stable`.
  Devuelve solo lo necesario para renderizar la pantalla de aceptación
  (`plantel_nombre`, `rol`, `email`, `valida`) a partir del token — nunca la
  fila completa de `invitaciones` ni datos de otras invitaciones. Otorgada a
  `anon` y `authenticated` (la persona invitada todavía no tiene sesión la
  primera vez que abre el link). Se evitó deliberadamente una política de
  `SELECT` abierta en `invitaciones` para este caso — expondría todas las
  invitaciones de todos los planteles a cualquiera, no solo la del token
  consultado.
- `aceptar_invitacion(p_token uuid, p_nombre_completo text)`: `language
  plpgsql`. Valida, en una sola transacción: `auth.uid()` no nulo, que el
  usuario no tenga perfil todavía (de un solo uso, mismo criterio que el
  alta inicial), que el token exista, que la invitación no esté usada ni
  expirada, y que el email de la invitación coincida (case-insensitive) con
  el email de la cuenta autenticada (`auth.email()`) — evita que alguien use
  el link de invitación de otra persona con su propia cuenta. Si todo pasa,
  inserta el perfil con el `plantel_id`/`rol` de la invitación y marca
  `usada_en = now()`. Otorgada solo a `authenticated` (requiere sesión ya
  creada por `signUp`/`signInWithPassword`, a diferencia del RPC anterior).

**Casos de uso**: `crear-invitacion` (valida email/rol, resuelve
`plantel_id`/`creada_por` desde la sesión actual — nunca del formulario,
mismo criterio que el resto de módulos; traduce el 42501 de RLS a mensaje de
negocio); `listar-invitaciones` (trae las invitaciones del plantel y deriva
el `estado` — `pendiente`/`usada`/`expirada` — a partir de
`usada_en`/`expira_en` en el propio caso de uso, no en la UI, para no
duplicar esa regla); `obtener-info-invitacion` (llama al RPC público, sin
requerir sesión); `aceptar-invitacion` (orquesta `signUp`, si no hay sesión
todavía, y luego el RPC `aceptar_invitacion` — la validación de negocio vive
en la función Postgres, no aquí, mismo patrón que
`registrar-plantel-inicial`).

**Misma limitación conocida de confirmación de email que el alta inicial**:
si el proyecto de Supabase tuviera activada la confirmación de correo,
`aceptar-invitacion` no podría completar el alta del perfil en el mismo paso
(`signUp` no deja sesión inmediata, y el RPC requiere `auth.uid()`). No se
resolvió de nuevo para este flujo — `aceptar-invitacion` simplemente informa
que falta confirmar el correo, sin duplicar la lógica de
`/auth/callback` (que hoy solo conoce el alta inicial de plantel, no
invitaciones). El proyecto de desarrollo actual no tiene la confirmación
activada, así que este camino no bloquea el uso normal.

**UI**: `/plantel/invitaciones` (protegida — redirige a `/login` sin sesión,
y muestra "no tienes permiso" si el rol no es `administrativo`/
`oficina_central`, replicando en la página el mismo criterio de rol que
exige la política RLS, para dar un mensaje explícito en vez de una lista
vacía silenciosa): formulario de alta (email + rol) y, debajo, la lista de
invitaciones con su estado y, para las pendientes, el link completo
(`{origin}/invitacion/{token}`) como texto seleccionable — sin botón de
"copiar" con JS, suficiente para el MVP. `/invitacion/[token]` (pública, sin
sesión previa — no está protegida por el middleware, que solo refresca
sesión sin forzar redirects): muestra "Te invitaron a unirte a {plantel}
como {rol}" y el formulario de aceptación (nombre completo + contraseña,
email fijo de la invitación mostrado con `readOnly`, no `disabled` — un
input `disabled` no envía su valor al hacer submit) si la invitación es
válida, o un mensaje claro si no existe/ya se usó/expiró.

**Cubierta desde el primer commit** por
`tests/aislamiento-invitaciones.test.ts` (CLAUDE.md 4.3) — ver/no-ver
invitación ajena, spoofing de `plantel_id` rechazado por RLS, más un test
funcional dedicado (la superficie de mayor riesgo de este módulo, no
cubierta por los tres casos estándar de aislamiento): un tercer usuario de
prueba (`test-invitado@controlescolar.test`) acepta una invitación creada
por la cuenta de prueba A y el test verifica que su perfil quede con el
`plantel_id` de A (no uno nuevo) y el `rol` asignado en la invitación (no
`oficina_central`). Idempotente entre corridas, mismo criterio que el resto
del suite.

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

### `public.alumnos`

Primer módulo de negocio real del MVP, definido en
`supabase/migrations/20260822165852_alumnos_alta_y_listado.sql`. Alta
mínima de alumno para inscripción y listado — sin expediente completo ni
datos sensibles (ver alcance en la sección "Alumnos" de Bounded contexts).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_alumnos_plantel_id`) por ser columna de política RLS |
| `matricula` | `text` | Obligatoria. Única por plantel (`unique(plantel_id, matricula)`) |
| `nombre_completo` | `text` | Obligatorio |
| `fecha_nacimiento` | `date` | Opcional |
| `estado` | `text` | `not null`, default `'activo'`, `check` restringido a `activo`/`inactivo` |
| `created_at` | `timestamptz` | Default `now()` |

RLS habilitada. Tres políticas:

- `alumnos_select_mismo_plantel`: cualquier usuario autenticado del plantel
  (`plantel_id = plantel_id_actual()`) puede ver sus alumnos — incluye
  alumnos y docentes, no solo staff, porque el listado por sí solo no
  expone datos sensibles.
- `alumnos_insert_staff_mismo_plantel`: solo perfiles con rol
  `administrativo` u `oficina_central` del mismo plantel pueden insertar
  (verificado vía `exists (select 1 from perfiles where id = auth.uid() and
  rol in (...))`).
- `alumnos_update_staff_mismo_plantel`: misma restricción de rol que el
  INSERT, para futuras ediciones (`USING` y `WITH CHECK` ambos acotados a
  `plantel_id_actual()`). No hay todavía un caso de uso de edición — la
  política se dejó lista porque no tiene costo adicional definirla junto
  con la tabla.

**Deuda técnica resuelta (2026-08-22)**: esta tabla se creó inicialmente sin
el test automático de aislamiento multi-tenant que CLAUDE.md 4.3 exige. Ya
está cubierta, junto con `planteles`/`perfiles`, por
`tests/aislamiento-multitenant.test.ts` — ver sección "Decisiones técnicas"
más abajo y la adenda de ADR-0001.

### `public.materias`

Catálogo de materias por plantel, definido en
`supabase/migrations/20260822184852_materias_catalogo.sql`. Base para poder
registrar calificaciones — sin horarios/carga académica (eso es Oleada 2).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_materias_plantel_id`) |
| `nombre` | `text` | Obligatorio. Único por plantel (`unique(plantel_id, nombre)`) |
| `created_at` | `timestamptz` | Default `now()` |

RLS habilitada. Dos políticas:

- `materias_select_mismo_plantel`: cualquier usuario autenticado del plantel
  puede ver sus materias.
- `materias_insert_staff_mismo_plantel`: solo `administrativo` u
  `oficina_central` pueden crear materias — a diferencia de `calificaciones`,
  no incluye `docente` (dar de alta el catálogo de materias es una tarea
  administrativa, no docente).

### `public.calificaciones`

Registro de calificaciones por alumno/materia/periodo, definido en
`supabase/migrations/20260822184856_calificaciones_registro_y_kardex.sql`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_calificaciones_plantel_id`) |
| `alumno_id` | `uuid` | `not null`, referencia `alumnos(id)`. Indexado (`idx_calificaciones_alumno_id`) |
| `materia_id` | `uuid` | `not null`, referencia `materias(id)` |
| `periodo` | `text` | Obligatorio, texto libre (ej. `"2026-1"`) — sin catálogo de periodos en este alcance |
| `calificacion` | `numeric(4,2)` | `not null`, `check` entre 0 y 10 |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |

Restricción `unique(alumno_id, materia_id, periodo)` — una sola calificación
por alumno/materia/periodo, es la que habilita el patrón de `upsert` del caso
de uso en vez de `insert`.

RLS habilitada. Tres políticas:

- `calificaciones_select_mismo_plantel`: cualquier usuario autenticado del
  plantel puede ver las calificaciones de su plantel.
- `calificaciones_insert_staff_mismo_plantel` /
  `calificaciones_update_staff_mismo_plantel`: a diferencia de `alumnos` y
  `materias`, incluyen el rol `docente` además de `administrativo` y
  `oficina_central` — calificar es tarea docente en la vida real, aunque hoy
  no exista todavía un flujo de alta de usuarios con ese rol. Se deja la
  política lista porque no tiene costo adicional definirla junto con la
  tabla (mismo criterio que la política de `UPDATE` sin uso todavía de
  `alumnos`).

**Cubierta desde el primer commit** por
`tests/aislamiento-calificaciones.test.ts` (CLAUDE.md 4.3) — ver/no-ver
materia y calificación ajenas, spoofing de `plantel_id` rechazado por RLS.

## Decisiones técnicas

### Testing de aislamiento multi-tenant (RLS)

CLAUDE.md 4.3 exige tests automáticos de aislamiento multi-tenant "desde el
primer commit que toque una tabla nueva", corriendo contra el SDK cliente
(nunca el SQL Editor de Supabase, que bypasea RLS). En vez de Supabase CLI
local con Docker (contradice el principio de "evitar Docker" del stack para
un equipo de una persona — sección 6 de CLAUDE.md), los tests corren con
**Vitest + `@supabase/supabase-js` contra el proyecto Supabase remoto de
desarrollo real**, usando dos cuentas de prueba fijas y reutilizables (no
efímeras, para no requerir `service_role`).

Detalle completo de la decisión y el trade-off aceptado (esas cuentas y sus
datos viven permanentemente en el proyecto de desarrollo) en la
[adenda de ADR-0001](adr/0001-validacion-arquitectura-inicial.md#adenda-2026-08-22-estrategia-de-testing-de-aislamiento-rls).

**Cómo correr los tests**: `npm test` (requiere `.env.local` con
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto de
desarrollo). Archivos: `tests/aislamiento-multitenant.test.ts` (planteles,
perfiles, alumnos), `tests/aislamiento-calificaciones.test.ts` (materias,
calificaciones — nuevo archivo en vez de extender el existente, para no
mezclar los casos de un módulo con los de otro, pero reusando el mismo
helper), `tests/helpers/cuenta-prueba.ts` (helper idempotente de alta/login
de cuentas de prueba, reutilizado sin cambios por ambos archivos),
`vitest.config.mts` + `tests/setup.ts` (carga de env y polyfill de
`WebSocket`, requerido por `@supabase/supabase-js` en Node 20).

Nota sobre orden de ejecución: cada archivo de test de Vitest corre en su
propio proceso/worker, así que `tests/aislamiento-calificaciones.test.ts` no
asume que `tests/aislamiento-multitenant.test.ts` ya corrió — dan de alta su
propio alumno de prueba (`TEST-A-001`) de forma idempotente si todavía no
existe, en vez de depender de un orden entre archivos.

## Diagrama de capas

_Pendiente._
