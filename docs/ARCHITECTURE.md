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
alcance (sesión futura): expediente completo, edición, baja. Un primer
conjunto mínimo de datos sensibles (contacto de tutor, información médica)
**ya se implementó** (ver "Datos sensibles cifrados" más abajo) — el
bloqueador que era resolver cifrado en reposo (CLAUDE.md 4.4) para esos
campos específicos quedó resuelto; el expediente completo y aviso de
privacidad/derechos ARCO siguen fuera de alcance.

**Casos de uso** (`src/modules/alumnos/casos-uso/`): `inscribir-alumno`,
`listar-alumnos`, `listar-alumnos-sin-vincular`, `obtener-alumno-vinculado`.
Mismo patrón que Identidad/Roles: reciben el cliente de Supabase ya
instanciado como parámetro en vez de crearlo internamente. Se aplica
hexagonal ligero aquí (no CRUD puro) porque hay lógica de negocio real:
validación de campos obligatorios y unicidad de matrícula por plantel, con
traducción del error crudo de Postgres (código `23505`, y `42501` cuando RLS
rechaza el INSERT por rol) a un mensaje de negocio claro — ver ADR-0001 sobre
el criterio de cuándo aplicar hexagonal.

`inscribir-alumno` resuelve el `plantel_id` a partir de
`obtener-perfil-actual` (reutilizado de Identidad/Roles) en vez de recibirlo
del formulario, para no depender de que el cliente envíe un `plantel_id`
arbitrario — la fuente de verdad del tenant del usuario es siempre su
perfil, nunca un valor de formulario.

**Datos sensibles cifrados (contacto de tutor, información médica)** —
primer conjunto mínimo de campos sensibles del expediente, resuelto en esta
sesión al implementar el mecanismo de cifrado que bloqueaba explícitamente
este alcance (ver nota de "Alcance actual" arriba). NO es el expediente
completo: solo tres columnas nuevas en `public.alumnos`
(`tutor_nombre_cifrado`, `tutor_telefono_cifrado`,
`informacion_medica_cifrada`), agregadas en
`supabase/migrations/20260822210809_datos_sensibles_alumno.sql` — pendiente
de aplicar manualmente en el SQL Editor de Supabase, igual que las
migraciones anteriores. Tampoco resuelve aviso de privacidad ni derechos
ARCO operables (CLAUDE.md 4.4) — siguen pendientes, ver `memory/CONTEXT.md`.

**Mecanismo — cifrado en la capa de aplicación, no en Postgres**
(`src/lib/cifrado/`): AES-256-GCM (autenticado) vía el módulo `crypto`
nativo de Node, sin librerías de terceros. Interfaz `ICifrador`
(`src/lib/cifrado/cifrador.ts`) con una única implementación real
`CifradorAesGcm` (`src/lib/cifrado/cifrador-aes-gcm.ts`) — aplica hexagonal
ligero aquí de forma explícita (CLAUDE.md 4.1): es una decisión de
algoritmo/proveedor real, no CRUD trivial. La clave sale de la variable de
entorno de **solo servidor** `CIFRADO_CLAVE` (nunca `NEXT_PUBLIC_*`, eso la
metería en el bundle del cliente), 32 bytes en base64 — si falta o tiene el
tamaño incorrecto, `CifradorAesGcm` falla al construirse con un error claro,
sin fallback silencioso. Formato del texto cifrado almacenado, documentado en
el propio código: `base64(IV de 12 bytes | ciphertext | authTag de 16
bytes)` en un solo string, con un IV aleatorio distinto en cada llamada a
`cifrar` (no negociable con GCM). **Por qué app-layer y no `pgcrypto`/Vault
de Supabase**: la clave nunca vive en la base de datos, solo en el proceso
del servidor — un dump de la base o acceso al dashboard de Supabase no
alcanza para descifrar nada. Razonamiento completo en la adenda
correspondiente de
[ADR-0001](adr/0001-validacion-arquitectura-inicial.md#adenda-2026-08-22-cifrado-de-campos-sensibles-en-capa-de-aplicación).

La instancia lista para usar (`src/lib/cifrado/instancia.ts`, construida una
sola vez desde `process.env.CIFRADO_CLAVE`, mismo patrón que
`src/lib/supabase/client.ts`/`server.ts`) vive **separada** de
`cifrador-aes-gcm.ts` (que solo exporta la clase) a propósito: así
`tests/dominio/cifrador.test.ts` puede importar la clase y probarla con una
clave de prueba propia sin que `CIFRADO_CLAVE` sea necesaria para correr
`npm test`.

**Casos de uso**: `actualizar-datos-sensibles-alumno.ts` recibe los tres
campos en texto plano, todos opcionales de forma independiente — un campo
`undefined` no se cifra ni se escribe (`update` parcial), para no forzar a
capturar los tres a la vez ni pisar un dato ya guardado que no vino en esta
edición. `obtener-kardex-alumno.ts` (usado por `/alumnos/[id]` y por el
portal de alumno en `/dashboard`) descifra estos tres campos **solo si el
rol del perfil actual es `administrativo` u `oficina_central`** — para
cualquier otro rol (`docente`, `alumno`, o rol indeterminado), `Kardex.
datosSensibles` viene `null` por completo (no los tres campos individuales
en `null`, que en cambio significa "no capturado" para quien sí tiene
acceso). **Es una decisión de autorización a nivel de APLICACIÓN, no de
RLS**: la política `alumnos_select_propio_o_staff` ya permite a `docente`
ver la fila completa de `alumnos` (matrícula, nombre, etc., incluidas estas
columnas cifradas como ciphertext ilegible), pero estos campos son más
sensibles que el resto del expediente — el cifrado en sí, más esta
verificación explícita de rol en el caso de uso, es la capa adicional que los
protege incluso de quien sí puede ver el resto del expediente por RLS. El
rol se resuelve en `/alumnos/[id]/page.tsx` vía `obtener-perfil-actual` y se
pasa como tercer parámetro (opcional) a `obtenerKardexAlumno` — el portal de
alumno en `/dashboard` no lo pasa, así que por defecto (`rolActual`
`undefined`) tampoco ve estos campos, consistente con la regla.

**UI**: sección "Datos sensibles" en `vista-kardex.tsx` (compartida entre
`/alumnos/[id]` y el portal de alumno), visible solo cuando
`kardex.datosSensibles` no es `null` — se muestra "No capturado" por campo
individual vacío. Enlace "Editar datos sensibles" →
`/alumnos/[id]/datos-sensibles` (formulario de los tres campos, todos
opcionales), protegida con el mismo criterio de rol verificado en el
servidor tanto al renderizar la página como al procesar el `Server Action`
del submit (`acciones.ts`) — no basta con ocultar el enlace en la UI.

**Vínculo `alumnos.perfil_id`** (columna agregada en
`supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql`): conecta
un perfil con rol `alumno` con su fila correspondiente de `alumnos` — hasta
esta sesión eran entidades completamente desconectadas, lo que hacía posible
tener una cuenta con rol `alumno` sin ningún expediente asociado, y (más
grave) hacía imposible restringir por RLS qué calificaciones/asistencia
puede ver un `alumno` (ver "Identidad/Roles" más abajo, sección "Sistema de
invitaciones", y la política `alumnos_select_propio_o_staff`). Dos casos de
uso nuevos la usan:

- `listar-alumnos-sin-vincular`: lista los alumnos del plantel con
  `perfil_id is null` — usado por `/plantel/invitaciones` para ofrecer, al
  invitar a alguien con rol `alumno`, solo alumnos que de verdad pueden
  vincularse.
- `obtener-alumno-vinculado`: dado un `perfilId`, devuelve el alumno cuyo
  `perfil_id` coincide (o `null` si no hay ninguno todavía) — usado por el
  portal de alumno en `/dashboard` para resolver directamente SU propio
  expediente, sin pasar por el listado general.

### Grupos

Bounded context nuevo (Oleada 2, "horarios/carga académica" acotado a su
mínimo — CLAUDE.md sección 8). Reemplaza el modelo anterior (calificaciones
y asistencia directas por alumno/materia/periodo o por alumno/día general)
por el modelo real que el usuario validó tras una plática de alcance: un
**grupo** es una instancia concreta de una materia impartida por un docente
en un periodo (ej. "Matemáticas — Grupo A"), estilo universidad — un alumno
se inscribe individualmente a varios grupos (`inscripciones`), no un solo
grupo fijo tipo primaria. **Reemplaza por completo el propósito de
`public.docente_materias`** (asignación docente<->materia general,
introducida y retirada en la misma sesión que este bounded context): la
asignación docente<->calificación/asistencia ahora se resuelve vía
`grupos.docente_id`, más fina que una asignación a la materia completa.

**Casos de uso** (`src/modules/grupos/casos-uso/`): `crear-grupo` (staff;
traduce 42501 y la violación de `unique(materia_id, nombre, periodo)` a
mensaje de negocio, mismo criterio que `crear-materia.ts`),
`listar-grupos-plantel` (staff; todos los grupos del plantel, con nombre de
materia/docente vía `select` anidado), `listar-mis-grupos` (docente; **con
filtro explícito** `eq('docente_id', user.id)` en la consulta — a diferencia
de `listar-materias.ts`/el antiguo `listar-mis-materias-asignadas.ts`, la
política `grupos_select_mismo_plantel` NO acota por rol, deja ver todos los
grupos del plantel a cualquier usuario autenticado, así que aquí sí hace
falta filtrar en la aplicación, documentado a propósito en el código para no
asumir que RLS ya lo hace), `asignar-docente-grupo` (staff; UPDATE de
`grupos.docente_id`, acepta `null` para dejar el grupo sin titular),
`inscribir-alumno-grupo` / `desinscribir-alumno-grupo` (staff; INSERT/DELETE
en `inscripciones`, mismo criterio de traducción de errores que
`crear-invitacion.ts`), `listar-inscripciones-grupo` (staff, y el docente
titular del grupo vía RLS; alumnos inscritos en un grupo específico, usado
tanto por `/plantel/grupos/[id]` como para poblar la lista de captura de
asistencia), `listar-grupos-de-alumno` (grupos en los que está inscrito un
alumno específico — ver decisión de diseño abajo).

**Decisión de diseño clave — `listar-grupos-de-alumno` resuelve la
intersección "grupos del alumno ∩ grupos del docente" sin lógica de
aplicación extra**: la política RLS `inscripciones_select_propia_o_staff_o_
docente` ya acota qué inscripciones puede ver cada rol. Cuando un perfil
`docente` invoca este caso de uso, RLS solo deja ver las inscripciones de
grupos donde ese docente es `grupos.docente_id` — el resultado YA ES la
intersección pedida por la tarea (los grupos del alumno en los que además
el docente es titular), sin duplicar esa condición en el código. Staff ve
todos los grupos del alumno sin restricción (RLS lo permite). Usado por
`/alumnos/[id]/calificaciones/nueva` para el selector de "grupo" al
registrar una calificación.

**Lógica de negocio no trivial que justifica hexagonal ligero aquí**
(CLAUDE.md 4.1): la integridad inscripción<->calificación/asistencia — un
alumno no puede recibir una calificación ni un registro de asistencia en un
grupo en el que no está inscrito, exigido a nivel de RLS (ver políticas de
`calificaciones`/`asistencias` más abajo), no solo de aplicación.

**Tablas `public.grupos` / `public.inscripciones`**, definidas en
`supabase/migrations/20260823003328_grupos_e_inscripciones.sql` —
**pendiente de aplicar manualmente en el SQL Editor de Supabase**, igual que
el resto de migraciones del proyecto.

`public.grupos`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_grupos_plantel_id`) |
| `materia_id` | `uuid` | `not null`, referencia `materias(id)`. Indexado (`idx_grupos_materia_id`) |
| `docente_id` | `uuid` | Opcional, referencia `perfiles(id)`. Indexado (`idx_grupos_docente_id`) — `null` mientras el grupo no tenga titular |
| `nombre` | `text` | Obligatorio (ej. "Grupo A") |
| `periodo` | `text` | Obligatorio, texto libre (ej. "2026-1"), mismo criterio que el `periodo` que antes vivía directo en `calificaciones` |
| `created_at` | `timestamptz` | Default `now()` |

Restricción `unique(materia_id, nombre, periodo)` — no puede haber dos
grupos con el mismo nombre para la misma materia y periodo.

`public.inscripciones`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_inscripciones_plantel_id`) |
| `alumno_id` | `uuid` | `not null`, referencia `alumnos(id)`. Indexado (`idx_inscripciones_alumno_id`) |
| `grupo_id` | `uuid` | `not null`, referencia `grupos(id)`. Indexado (`idx_inscripciones_grupo_id`) |
| `created_at` | `timestamptz` | Default `now()` |

Restricción `unique(alumno_id, grupo_id)` — un alumno no puede inscribirse
dos veces al mismo grupo.

RLS habilitada en ambas tablas.

- `grupos_select_mismo_plantel`: cualquier usuario autenticado del plantel
  ve todos los grupos (sin restricción por rol/titularidad — ver nota en
  `listar-mis-grupos` arriba sobre por qué eso importa).
- `grupos_insert_staff` / `grupos_update_staff`: solo
  `administrativo`/`oficina_central` del mismo plantel puede crear grupos o
  cambiar su titular — un docente no puede auto-asignarse un grupo.
- `inscripciones_select_propia_o_staff_o_docente`: el propio alumno ve sus
  inscripciones (`alumnos.perfil_id = auth.uid()`); staff ve todas las del
  plantel; un docente ve solo las inscripciones de grupos donde es
  `grupos.docente_id` — es la condición que habilita la intersección
  automática descrita arriba.
- `inscripciones_insert_staff` / `inscripciones_delete_staff`: solo staff
  puede inscribir/desinscribir alumnos.

**UI**: `/plantel/grupos` (protegida, solo staff, mismo criterio de "no
tienes permiso" que `/plantel/invitaciones`): formulario de alta (materia +
nombre + periodo + docente opcional) y, debajo, la lista de grupos del
plantel con un enlace "Gestionar inscripciones" por fila hacia
`/plantel/grupos/[id]`. `/plantel/grupos/[id]` (protegida, mismo criterio):
nombre del grupo, selector para cambiar/asignar el docente titular, lista de
alumnos inscritos con botón "Desinscribir" por fila (sin diálogo de
confirmación bloqueante, CLAUDE.md 7 — desinscribir es reversible y no borra
el historial de calificaciones/asistencia del alumno en ese grupo, ver
comentario en `desinscribir-alumno-grupo.ts`), y un formulario para inscribir
un alumno más (selector de alumnos del plantel que todavía no están en ese
grupo, calculado en la página restando `listar-inscripciones-grupo` de
`listar-alumnos`).

**Cubierta desde el primer commit** por `tests/aislamiento-grupos.test.ts`
(CLAUDE.md 4.3) — reemplaza a `tests/aislamiento-docente-materias.test.ts`
(retirado junto con `docente_materias`), migrando la misma intención de
aislamiento **dentro** del mismo tenant al nuevo esquema: un docente titular
de un grupo puede calificar/tomar asistencia de alumnos inscritos en ESE
grupo; el mismo docente NO puede hacerlo en un grupo donde no es titular
(aunque el alumno sí esté inscrito ahí, para aislar ambas causas); un alumno
NO inscrito en un grupo no puede recibir calificación ni asistencia en él
(validación de integridad, rechazada incluso para staff); y staff sigue con
visibilidad/escritura completa, solo sujeto a esa misma validación de
integridad. Usa la misma cuenta de docente de prueba que el archivo
retirado (`test-docente-materias@controlescolar.test`) para no crear una
cuenta nueva en el proyecto de desarrollo.

### Calificaciones

Alcance actual (mínimo): catálogo de materias por plantel, registro (y
corrección) de calificaciones por alumno/**grupo** (el grupo ya trae materia
y periodo, ver bounded context "Grupos" arriba), kardex de un alumno con
promedio general. Explícitamente fuera de este alcance: edición/borrado de
calificaciones más allá de re-registrar (upsert), boletas/reportes en PDF, y
gestión de periodos escolares como catálogo propio (`periodo` es texto
libre, ej. "2026-1", y vive en `grupos`, no en `calificaciones`).

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
usa `.upsert()` con `onConflict: 'alumno_id,grupo_id'` en vez de
`.insert()`. Volver a capturar el mismo grupo para un alumno actualiza la
calificación existente en vez de fallar por violación de unicidad — es el
comportamiento esperado cuando un docente corrige una nota ya capturada, y
es explícitamente la única forma de "editar" en este alcance (no hay un
caso de uso de edición/borrado separado).

**Kardex**: `obtener-kardex-alumno` trae el alumno, sus calificaciones (con
el nombre de grupo/periodo/materia vía `select` anidado de Supabase,
`grupo:grupos(nombre, periodo, materia:materias(nombre))` — el join ahora
pasa por `grupo_id -> grupos -> materias` en vez de columnas directas), el
promedio general (`calcularPromedio` sobre todas las calificaciones del
alumno) y si está aprobado en cada una (`estaAprobado` aplicado a la
calificación individual — no hay promedio por materia todavía, es una sola
calificación por grupo).

**Tabla `public.calificaciones`**, definida originalmente en
`supabase/migrations/20260822184856_calificaciones_registro_y_kardex.sql` y
migrada al esquema por grupo en
`supabase/migrations/20260823003332_calificaciones_por_grupo.sql` —
**pendiente de aplicar manualmente en el SQL Editor de Supabase**. Esa
migración **borra las filas existentes** de la tabla antes de aplicar el
esquema nuevo (no había forma de resolver retroactivamente a qué grupo
pertenecía cada calificación vieja) — aceptable porque, al momento de esta
sesión, esa tabla solo tenía datos de desarrollo/prueba.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_calificaciones_plantel_id`) |
| `alumno_id` | `uuid` | `not null`, referencia `alumnos(id)`. Indexado (`idx_calificaciones_alumno_id`) |
| `grupo_id` | `uuid` | `not null`, referencia `grupos(id)` — reemplaza a `materia_id`/`periodo` (columnas retiradas) |
| `calificacion` | `numeric(4,2)` | `not null`, `check` entre 0 y 10 |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |

Restricción `calificaciones_alumno_grupo_key` = `unique(alumno_id,
grupo_id)` — reemplaza a `unique(alumno_id, materia_id, periodo)`, misma
función: habilita el patrón de `upsert` del caso de uso.

RLS habilitada. Tres políticas — **reemplazadas** (drop + create) en
`supabase/migrations/20260823003332_calificaciones_por_grupo.sql` (los
nombres exactos de las políticas que reemplaza, verificados contra
`supabase/migrations/20260823000049_asignacion_docente_materia.sql`, eran
`calificaciones_select_propio_o_staff_o_docente_asignado`,
`calificaciones_insert_staff_o_docente_asignado`,
`calificaciones_update_staff_o_docente_asignado`):

- `calificaciones_select_propia_o_staff_o_docente_grupo`: dentro del
  plantel, `administrativo`/`oficina_central` siguen viendo todas las
  calificaciones del plantel (sin cambio); un perfil con rol `alumno` solo
  ve las calificaciones cuyo `alumno_id` corresponde al alumno vinculado a
  su propio perfil (sin cambio); un perfil con rol `docente` ve **solo** las
  calificaciones de grupos donde es `grupos.docente_id` — reemplaza la
  condición anterior (`docente_materias`), ahora acotada al grupo concreto,
  no a la materia completa.
- `calificaciones_insert_staff_o_docente_grupo` /
  `calificaciones_update_staff_o_docente_grupo`: **exigen además, para
  CUALQUIER rol (incluido staff)**, que el alumno esté inscrito en el grupo
  (`exists (select 1 from inscripciones i where i.alumno_id =
  calificaciones.alumno_id and i.grupo_id = calificaciones.grupo_id)`) — es
  la validación de integridad nueva descrita en el bounded context "Grupos".
  Además de eso, staff sigue pudiendo insertar/actualizar cualquier
  calificación del plantel (sin cambio de rol); `docente` solo puede
  hacerlo en un grupo donde es `grupos.docente_id`.

`/alumnos/[id]/calificaciones/nueva` ya no filtra el selector de "materia"
sino que muestra los **grupos** en los que el alumno específico está
inscrito (`listar-grupos-de-alumno`, ver bounded context "Grupos" — para un
docente, el resultado YA ES la intersección grupos-del-alumno ∩
grupos-del-docente, sin lógica adicional en la página). Si el alumno no está
inscrito en ningún grupo (o, para un docente, en ninguno de los suyos), se
muestra un mensaje explícito invitando a inscribirlo primero desde
`/plantel/grupos`, en vez de un selector vacío confuso.

`registrar-calificacion.ts` traduce el 42501 crudo de RLS a uno de dos
mensajes de negocio distintos, aunque Postgres solo devuelve un único código
para ambas causas (viven en el mismo `WITH CHECK`): si el usuario es
`docente` y no es el titular del grupo (`grupos.docente_id`, consultado
aparte — visible para cualquiera del plantel vía `grupos_select_mismo_
plantel`, sin restricción de rol), el mensaje es "No tienes este grupo
asignado"; en cualquier otro caso (staff, o docente titular pero alumno no
inscrito), el mensaje es "Este alumno no está inscrito en este grupo".

**Cubierta desde el primer commit** por
`tests/aislamiento-calificaciones.test.ts` (CLAUDE.md 4.3) — ver/no-ver
materia y calificación ajenas, spoofing de `plantel_id` rechazado por RLS,
migrado al esquema por grupo (crea un grupo y una inscripción antes de
registrar la calificación de prueba). El aislamiento por titularidad
docente<->grupo específicamente vive en `tests/aislamiento-grupos.test.ts`
(ver bounded context "Grupos" arriba).

### Asistencia

Alcance actual (mínimo): asistencia **por sesión de grupo** — un alumno
puede tener asistencia distinta en dos materias el mismo día (antes era
diaria y general del plantel, un solo registro por alumno/día; ese modelo
se reemplazó junto con el bounded context "Grupos", ver arriba). Explícitamente
fuera de este alcance: reportes de tendencias, y notificaciones automáticas
a padres por inasistencia (eso corresponde al módulo Comunicación, todavía
no implementado).

**Casos de uso** (`src/modules/asistencia/casos-uso/`):
`registrar-asistencia-del-dia`, `obtener-asistencia-alumno`. Mismo patrón de
cliente de Supabase inyectado que Alumnos/Calificaciones/Identidad. Se
aplica hexagonal ligero aquí de forma explícita — CLAUDE.md 4.1 usa
Asistencia, junto con Calificaciones e Identidad/Roles, como ejemplo
textual de "lógica de negocio no trivial".

**Retirado en esta sesión**: `listar-alumnos-para-captura.ts` (listaba
TODOS los alumnos activos del plantel para la captura general) — la lista de
alumnos a capturar ahora viene de `listar-inscripciones-grupo.ts` (módulo
Grupos), acotada al grupo elegido, no al plantel completo.

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
`tests/dominio/asistencia.test.ts`. **Sin cambios en esta sesión**:
`obtener-asistencia-alumno` sigue calculando el porcentaje sobre TODOS los
registros de asistencia del alumno, combinados a través de todos sus
grupos — decisión explícita de alcance para no complicar el kardex con un
desglose por grupo todavía.

**Decisión de diseño — upsert masivo en vez de insert por alumno**:
`registrar-asistencia-del-dia` recibe el `grupoId`, la `fecha` y el arreglo
completo de `{alumno_id, estado}` de ese grupo/día, y hace un solo
`.upsert()` con `onConflict: 'alumno_id,grupo_id,fecha'` — una sola llamada
de red para toda la lista, no una petición por alumno (CLAUDE.md 7 pide
explícitamente "modo asistido/wizard para... captura masiva"). Volver a
capturar la asistencia del mismo grupo/día para el mismo alumno corrige el
registro existente en vez de fallar por violación de unicidad, mismo
criterio que `registrar-calificacion.ts` — no hay un caso de uso de
edición/corrección separado, re-capturar ES la forma de corregir. Los
`registros` deben venir SOLO de alumnos inscritos en el grupo — la UI lo
garantiza poblando la lista con `listar-inscripciones-grupo`, y la política
RLS lo exige también a nivel de base de datos (ver abajo).

**Tabla `public.asistencias`**, definida originalmente en
`supabase/migrations/20260822190214_asistencia_diaria.sql` y migrada al
esquema por grupo en
`supabase/migrations/20260823003336_asistencia_por_grupo.sql` — **pendiente
de aplicar manualmente en el SQL Editor de Supabase**. Esa migración también
**borra las filas existentes** antes de aplicar el esquema nuevo, mismo
motivo y mismo criterio de aceptación que en `calificaciones` (solo datos de
desarrollo/prueba).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_asistencias_plantel_id`) |
| `alumno_id` | `uuid` | `not null`, referencia `alumnos(id)`. Indexado (`idx_asistencias_alumno_id`) |
| `grupo_id` | `uuid` | `not null`, referencia `grupos(id)` — columna nueva |
| `fecha` | `date` | Obligatoria |
| `estado` | `text` | `not null`, `check` restringido a `presente`/`ausente`/`retardo`/`justificado` |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |

Restricción `asistencias_alumno_grupo_fecha_key` = `unique(alumno_id,
grupo_id, fecha)` — reemplaza a `unique(alumno_id, fecha)` (nombre real
verificado antes del `drop constraint`:
`asistencias_alumno_id_fecha_key`, el default que asigna Postgres a una
`unique` inline sin nombre explícito). Un alumno puede tener un registro
por grupo/día en vez de uno solo por día — es lo que habilita asistencia
distinta en dos materias el mismo día.

RLS habilitada. Tres políticas — **reemplazadas** (drop + create) en
`supabase/migrations/20260823003336_asistencia_por_grupo.sql` (nombres
exactos de las políticas que reemplaza, verificados contra
`supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql`:
`asistencias_select_propio_o_staff`, `asistencias_insert_staff_mismo_
plantel`, `asistencias_update_staff_mismo_plantel`):

- `asistencias_select_propia_o_staff_o_docente_grupo`: dentro del plantel,
  `administrativo`/`oficina_central` siguen viendo toda la asistencia del
  plantel (sin cambio); un perfil `alumno` solo ve los registros del alumno
  vinculado a su propio perfil (sin cambio); un perfil `docente` ve **solo**
  la asistencia de grupos donde es `grupos.docente_id` — antes veía toda la
  asistencia del plantel sin restricción (decisión anterior, ya superada).
- `asistencias_insert_staff_o_docente_grupo` /
  `asistencias_update_staff_o_docente_grupo`: mismo criterio de integridad
  que `calificaciones` — exigen que el alumno esté inscrito en el grupo,
  para CUALQUIER rol incluido staff; además de eso, staff sigue pudiendo
  insertar/actualizar cualquier registro del plantel, `docente` solo en un
  grupo donde es titular.

**Cubierta desde el primer commit** por `tests/aislamiento-asistencia.test.ts`
(CLAUDE.md 4.3) — ver/no-ver registro de asistencia ajeno, spoofing de
`plantel_id` rechazado por RLS, migrado al esquema por grupo. Usa una fecha
fija determinista (`2026-01-15`) para que la corrida sea idempotente entre
ejecuciones (el upsert por `alumno_id,grupo_id,fecha` no duplica filas). El
aislamiento por titularidad docente<->grupo específicamente vive en
`tests/aislamiento-grupos.test.ts`.

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
- **`dirigido_a` pasó de ser informativo a filtrar visibilidad de verdad**
  (ver política `avisos_select_segun_rol` más abajo,
  `supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql`)
  — con el sistema de invitaciones ya existen cuentas reales de
  `docente`/`alumno`, así que dejó de tener sentido que ese campo fuera solo
  decorativo.

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

- `avisos_select_segun_rol` (reemplaza a `avisos_select_mismo_plantel` desde
  `supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql`):
  dentro del plantel, `administrativo`/`oficina_central` ven TODOS los avisos
  (sin cambio); `docente` ve los avisos con `dirigido_a in ('todos',
  'docentes')`; `alumno` ve los avisos con `dirigido_a in ('todos',
  'alumnos')`. Es la única política de SELECT de las cuatro tocadas en esta
  sesión que también cambia el comportamiento para `docente` (antes veía
  avisos dirigidos solo a `alumnos`, y viceversa) — decisión consciente: ya
  no tiene sentido dejar `dirigido_a` como campo decorativo ahora que existen
  cuentas reales de docente/alumno.
- `avisos_insert_staff_mismo_plantel`: exige `plantel_id =
  plantel_id_actual()`, `autor_id = auth.uid()` (nadie puede publicar un
  aviso a nombre de otro usuario) y rol `administrativo` u `oficina_central`
  — a diferencia de `calificaciones`/`asistencias`, no incluye `docente`
  (publicar avisos institucionales es tarea administrativa en este alcance,
  no docente). **Sin cambios** en esta sesión.

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
(docente/alumno/administrativo) a un plantel ya existente, **vínculo
alumno-perfil** (una invitación con rol `alumno` puede vincularse a una fila
existente de `alumnos`) y **portales por rol** (navegación de `/dashboard`
distinta según `administrativo`/`oficina_central`/`docente`/`alumno`, y RLS
de SELECT endurecida para que `alumno` solo vea sus propios datos — cierra la
Oleada 1 completa del MVP, CLAUDE.md sección 3). Explícitamente fuera de este
alcance: envío real de correo (el link de invitación se comparte
manualmente, mismo criterio que Comunicación) y revocar/reenviar
invitaciones (solo alta + aceptación + expiración pasiva).

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
| `alumno_id` | `uuid` | Referencia `alumnos(id)`. Agregada en `supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql` — solo relevante cuando `rol = 'alumno'` (sin `check` que lo obligue: es válido invitar a un `alumno` sin seleccionar a cuál vincular, ver `crear-invitacion` más abajo) |

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
  **Actualizada en
  `supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql`**: si la
  invitación trae `alumno_id`, después de insertar el perfil también hace
  `update alumnos set perfil_id = auth.uid() where id = alumno_id and
  plantel_id = ... and perfil_id is null` — el `perfil_id is null` en el
  `where` es defensivo (evita pisar un vínculo ya existente en una carrera
  entre dos aceptaciones concurrentes de invitaciones al mismo alumno,
  aunque en la práctica `crear-invitacion` ya filtra alumnos sin vincular al
  momento de crear la invitación). Todo dentro de la misma transacción que el
  resto de la función — si algo falla, no queda un perfil sin alumno
  vinculado a medias.

**Casos de uso**: `crear-invitacion` (valida email/rol, resuelve
`plantel_id`/`creada_por` desde la sesión actual — nunca del formulario,
mismo criterio que el resto de módulos; traduce el 42501 de RLS a mensaje de
negocio; acepta un `alumnoId` opcional — solo relevante cuando `rol ===
'alumno'` —, y si viene, valida con un `select` propio que el alumno exista
en el plantel y no tenga ya `perfil_id`, antes de insertarlo en la
invitación); `listar-invitaciones` (trae las invitaciones del plantel y
deriva el `estado` — `pendiente`/`usada`/`expirada` — a partir de
`usada_en`/`expira_en` en el propio caso de uso, no en la UI, para no
duplicar esa regla); `obtener-info-invitacion` (llama al RPC público, sin
requerir sesión); `aceptar-invitacion` (orquesta `signUp`, si no hay sesión
todavía, y luego el RPC `aceptar_invitacion` — la validación de negocio vive
en la función Postgres, no aquí, mismo patrón que
`registrar-plantel-inicial`).

**UI de invitación con alumno** (`/plantel/invitaciones`,
`formulario.tsx`): cuando se selecciona el rol "Alumno" en el `<select>` de
rol, aparece un segundo `<select>` con los alumnos del plantel sin cuenta
vinculada (`listar-alumnos-sin-vincular`, ver sección "Alumnos" más arriba)
— mostrar/ocultar se resuelve con `useState` en el cliente, sin librería
nueva (CLAUDE.md 7). Si no hay alumnos sin vincular, se muestra un mensaje
explícito invitando a inscribir alumnos primero y se deshabilita el botón de
enviar para ese rol — en vez de dejar crear una invitación de alumno "a
ciegas" cuando sí hay candidatos disponibles.

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

**Portales por rol** (último ítem de la Oleada 1 del MVP, CLAUDE.md sección
3 — cierra el ciclo completo de valor). `/dashboard`
(`src/app/dashboard/page.tsx`) deja de ser idéntico para todos los roles:

- `administrativo`/`oficina_central`: navegación completa — Alumnos,
  Materias, Asistencia, Avisos, Invitar usuarios, Grupos (ver sección
  "Grupos" en Bounded contexts — el enlace de navegación se llamó
  "Asignaciones" hasta la sesión que introdujo el bounded context Grupos, ver
  más abajo), Solicitudes ARCO, Derechos ARCO.
- `docente`: Alumnos (para navegar a kardex y registrar
  calificaciones/asistencia), Asistencia, Avisos — sin Materias (solo staff
  administrativo crea materias) ni Invitar usuarios (solo staff da de alta
  cuentas).
- `alumno`: sin menú de navegación general — la lista genérica de `/alumnos`
  ya no tiene sentido para este rol (tras endurecer la RLS de SELECT, ver
  más abajo, sería una lista de un solo elemento, confusa). En vez de eso,
  `/dashboard` resuelve directamente el alumno vinculado al perfil actual
  (`obtener-alumno-vinculado`, ver sección "Alumnos") y muestra su kardex +
  asistencia (componente compartido `VistaKardexAlumno`,
  `src/app/alumnos/[id]/vista-kardex.tsx` — extraído de `/alumnos/[id]` para
  no duplicar ese layout entre ambas pantallas, con un flag `puedeGestionar`
  que oculta los botones de "Registrar calificación"/"Capturar asistencia"
  en el portal de alumno, porque esas acciones siempre fallarían por RLS
  para este rol) y sus avisos (`listar-avisos`, ya filtrados por
  `avisos_select_segun_rol`). Si el perfil todavía no está vinculado a
  ningún alumno (`obtener-alumno-vinculado` devuelve `null` — ej. la
  invitación se creó sin seleccionar alumno), se muestra un mensaje
  explícito ("tu cuenta todavía no está vinculada a un expediente de
  alumno, contacta a la administración de tu plantel") en vez de fallar o
  mostrar una página vacía confusa.

`/alumnos` (listado general) también se ajustó: el botón "Inscribir alumno"
solo se muestra a `administrativo`/`oficina_central` (mismo rol que exige
`alumnos_insert_staff_mismo_plantel`) — antes se mostraba a cualquier rol y
fallaba por RLS para `docente`/`alumno`. La barra de navegación entre
módulos que antes vivía ahí (Materias/Asistencia/Avisos/Invitar usuarios) se
retiró de esa página — ahora vive únicamente en `/dashboard`, ya filtrada
por rol, para no duplicar navegación sin filtrar en dos lugares.

**Endurecimiento de RLS de SELECT por rol** — el otro lado de esta sesión,
acoplado a "portales por rol" porque exponer una UI reducida a `alumno` sin
restringir también la base de datos hubiera sido solo cosmético (cualquiera
con las credenciales `anon` podría seguir consultando todo por API directa).
Migración `supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql`
— reemplaza (drop + create) las políticas de SELECT de `alumnos`,
`calificaciones`, `asistencias` y `avisos`, dejando intactas todas las
políticas de INSERT/UPDATE (ver detalle de cada política en la sección de su
módulo, arriba). Antes de esta migración, cualquier cuenta autenticada del
plantel —incluida una con rol `alumno`, posible desde que existe el sistema
de invitaciones— veía las calificaciones y asistencia de TODOS los alumnos
del plantel, no solo las suyas: violaba mínimo privilegio y el principio de
"interés superior del menor" (CLAUDE.md 4.4). `docente` mantuvo, en esta
sesión, visibilidad de TODO el plantel para `calificaciones` — no existía
todavía asignación de materias/grupos a un docente específico, resolver eso
quedó fuera de esta sesión. **Actualización (misma fecha, sesión
posterior)**: para `calificaciones` específicamente, esto se resolvió
primero con una asignación docente<->materia general
(`public.docente_materias`), y `asistencias` quedó sin cambio a propósito
(era diaria y general del plantel, no por materia/clase). **Actualización
posterior (bounded context Grupos)**: ambas decisiones quedaron superadas —
`docente_materias` se retiró por completo y tanto `calificaciones` como
`asistencias` se acotan ahora a `grupos.docente_id`, más fino que una
materia completa; ver sección "Grupos" en Bounded contexts, arriba, para el
diseño vigente.

**Aviso de privacidad y derechos ARCO (LFPDPPP, CLAUDE.md 4.4)** — último
pendiente explícito de cumplimiento que quedaba registrado en
`memory/CONTEXT.md` desde la sesión de cifrado de datos sensibles. Dos
piezas, ambas dentro de este bounded context (el mismo criterio que
`plantel_id_actual()`/roles: es "quién puede ver/hacer qué con datos
personales", propio de Identidad):

- **Aviso de privacidad** (`/aviso-privacidad`, página pública, sin sesión
  requerida): contenido legal mínimo LFPDPPP — identidad del responsable,
  finalidades, datos que se recaban, y sección de Derechos ARCO con enlace a
  `/derechos-arco`. La identidad del responsable usa el nombre del plantel de
  la sesión actual si existe, o un texto genérico ("la institución educativa
  que opera esta plataforma") si no hay sesión — **no es jurídicamente
  suficiente por sí solo para producción**, hay una nota explícita en el
  código (`src/app/aviso-privacidad/page.tsx`) señalando que cada institución
  debe completar sus propios datos legales reales (razón social, RFC,
  domicilio, datos del responsable de protección de datos) antes de operar.
  Se acepta **una sola vez, al registrar la cuenta** (`/registro`, checkbox
  obligatorio "He leído y acepto el aviso de privacidad", validado tanto en
  cliente como en el servidor en `src/app/registro/acciones.ts`) — decisión
  de alcance explícita de esta sesión: no se repite en cada formulario de
  captura de datos (inscribir alumno, crear invitación, etc.), porque
  aceptarlo una vez al crear la cuenta ya cubre el requisito legal de
  consentimiento informado antes de que la cuenta pueda capturar cualquier
  dato personal en el sistema.
- **Derechos ARCO operables como caso de uso real** (no solo mencionados en
  el aviso) — ver "Solicitudes ARCO" más abajo.

**Solicitudes ARCO** — tabla `public.solicitudes_arco`, definida en
`supabase/migrations/20260822214000_solicitudes_arco.sql`. Es el **canal
formal** de la solicitud, no la ejecución automática: una solicitud de
"cancelación" no borra ningún dato por sí sola — el staff la revisa y la
atiende manualmente (dar de baja un alumno, corregir un dato en su
expediente, etc., operaciones que ya existen por separado o son manuales) y
luego marca la solicitud como resuelta con una respuesta de texto. Alcance
explícito de esta sesión: sin automatización de ninguno de los cuatro tipos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_solicitudes_arco_plantel_id`) |
| `solicitante_id` | `uuid` | `not null`, referencia `perfiles(id)` — quién levanta la solicitud |
| `tipo` | `text` | `not null`, `check` restringido a `acceso`/`rectificacion`/`cancelacion`/`oposicion` |
| `descripcion` | `text` | `not null` — texto libre de la solicitud |
| `estado` | `text` | `not null`, default `'pendiente'`, `check` restringido a `pendiente`/`resuelta` |
| `respuesta` | `text` | Opcional — texto libre del staff al resolver |
| `atendida_por` | `uuid` | Opcional, referencia `perfiles(id)` — quién la resolvió |
| `created_at` / `resuelta_en` | `timestamptz` | `resuelta_en` `null` hasta que se resuelve |

RLS habilitada. Tres políticas:

- `solicitudes_arco_select_propia_o_staff`: el solicitante ve su propia
  solicitud (`solicitante_id = auth.uid()`); staff (`administrativo`/
  `oficina_central`) del mismo plantel ve todas las del plantel.
- `solicitudes_arco_insert_propia`: **cualquier rol autenticado** puede
  insertar una solicitud sobre sí mismo (`solicitante_id = auth.uid()`) —
  a diferencia de la mayoría de tablas del proyecto, no se restringe por rol
  el INSERT: los derechos ARCO aplican a todo usuario (alumno, docente,
  administrativo), no solo a staff.
- `solicitudes_arco_update_staff`: solo staff del mismo plantel puede
  actualizar (marcar resuelta) — sin restricción de que sea staff del mismo
  plantel *que el de la solicitud específica* más allá de `plantel_id_actual()`
  en el `USING`, mismo patrón que el resto de políticas de `UPDATE` staff del
  proyecto.

**Casos de uso** (`src/modules/identidad/casos-uso/`): `crear-solicitud-arco`
(cualquier rol, `descripcion`/`tipo` obligatorios, `solicitante_id`/
`plantel_id` resueltos desde la sesión actual, nunca del formulario, mismo
criterio que el resto del proyecto), `listar-mis-solicitudes-arco` (las del
usuario actual, para que vea el estado de las suyas), `listar-solicitudes-
arco-plantel` (staff ve todas las del plantel, con el nombre del solicitante
vía `select` anidado — usa el nombre explícito de la constraint FK,
`perfiles!solicitudes_arco_solicitante_id_fkey`, porque la tabla tiene DOS
relaciones con `perfiles` —`solicitante_id` y `atendida_por`— y PostgREST
necesita desambiguar cuál usar), `resolver-solicitud-arco` (staff marca
resuelta con una `respuesta`; valida explícitamente el rol de staff del
usuario actual antes de intentar el UPDATE, aunque RLS también lo bloquea —
mismo criterio de "mensaje de negocio claro" que `crear-invitacion.ts`).

**UI**: `/derechos-arco` (protegida, cualquier rol autenticado): formulario
de alta (selector de los 4 tipos + descripción) y, debajo, la lista de
solicitudes propias con su estado y la respuesta del staff si ya está
resuelta. `/plantel/solicitudes-arco` (protegida, solo staff, mismo criterio
de "no tienes permiso" explícito que `/plantel/invitaciones`): lista de
solicitudes del plantel con un formulario de respuesta por fila
(`src/app/plantel/solicitudes-arco/formulario.tsx`, un `useActionState` por
solicitud vía `resolverSolicitudArcoAction.bind(null, solicitudId)` — permite
que cada fila tenga su propio estado de envío/error sin un formulario global
con múltiples botones). Enlace "Derechos ARCO" en la navegación de todos los
roles (incluido el portal de `alumno` en `/dashboard`, que no usa la lista de
navegación general) y "Solicitudes ARCO" en la navegación de staff.

**Cubierta desde el primer commit** por
`tests/aislamiento-solicitudes-arco.test.ts` (CLAUDE.md 4.3) — ver/no-ver
solicitud ajena, intento de UPDATE bloqueado por RLS (sin efecto, no error,
a diferencia del INSERT con `WITH CHECK`), spoofing de `plantel_id`
rechazado por RLS, y un caso funcional: la cuenta A (rol `oficina_central`
por ser el alta inicial de su plantel) resuelve su propia solicitud
actuando como staff del plantel — no requirió una tercera cuenta de prueba
dedicada porque la cuenta A ya es staff de su propio plantel.

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

RLS habilitada. Política `perfiles_select_mismo_plantel` (reemplaza a
`perfiles_select_propio` desde
`supabase/migrations/20260822213647_perfiles_visibles_mismo_plantel.sql` —
**pendiente de aplicar manualmente en el SQL Editor de Supabase**, igual que
las migraciones anteriores): un usuario autenticado ve cualquier perfil de su
mismo plantel (`plantel_id = plantel_id_actual()`), no solo el propio.
Corrige el bug cosmético de "Autor desconocido" en avisos —
`listar-avisos.ts` (ver sección "Comunicación" abajo) hace un join a
`perfiles.nombre_completo` para mostrar el autor de un aviso, y con la
política anterior ese join fallaba por RLS para cualquiera que no fuera el
autor mismo. El nombre/rol de un colega del mismo plantel no se considera
información sensible (a diferencia de los campos cifrados de `alumnos`,
protegidos aparte por CLAUDE.md 4.4) — mismo criterio ya usado en
`materias_select_mismo_plantel`. No afecta el aislamiento **entre**
planteles (sigue acotado por `plantel_id_actual()`), ni a
`plantel_id_actual()` misma (`security definer`, corre con privilegios del
owner de la función, no depende de esta política). Cubierto por un test
nuevo en `tests/aislamiento-alumnos.test.ts` ("visibilidad de perfiles
dentro del mismo plantel") — el aislamiento entre planteles ya estaba
cubierto por `tests/aislamiento-multitenant.test.ts`.

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

| `perfil_id` | `uuid` | Único, referencia `perfiles(id)`. `null` mientras el alumno no tenga cuenta vinculada. Agregada en `supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql` |
| `tutor_nombre_cifrado` / `tutor_telefono_cifrado` / `informacion_medica_cifrada` | `text` | Opcionales. Almacenan CIPHERTEXT (AES-256-GCM en capa de aplicación, `src/lib/cifrado/`), nunca el dato en claro. Agregadas en `supabase/migrations/20260822210809_datos_sensibles_alumno.sql` — ver detalle en "Datos sensibles cifrados" arriba |

RLS habilitada. Tres políticas (sin política nueva para las columnas de
datos sensibles — heredan SELECT/UPDATE de las mismas políticas de la tabla;
la restricción de que solo `administrativo`/`oficina_central` las lean en
claro es de aplicación, no de RLS, ver "Datos sensibles cifrados" arriba):

- `alumnos_select_propio_o_staff` (reemplaza a `alumnos_select_mismo_plantel`
  desde `supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql`,
  ver detalle y motivo del cambio en la sección "Identidad/Roles" más abajo,
  bloque "Vínculo `alumnos.perfil_id`"): dentro del plantel
  (`plantel_id = plantel_id_actual()`), un perfil con rol `administrativo`,
  `oficina_central` o `docente` sigue viendo TODOS los alumnos del plantel
  (sin cambio de comportamiento); un perfil con rol `alumno` solo ve la fila
  cuyo `perfil_id` es el suyo (`perfil_id = auth.uid()`) — antes veía a
  todos los alumnos del plantel, lo cual violaba mínimo privilegio.
- `alumnos_insert_staff_mismo_plantel`: solo perfiles con rol
  `administrativo` u `oficina_central` del mismo plantel pueden insertar
  (verificado vía `exists (select 1 from perfiles where id = auth.uid() and
  rol in (...))`) — **sin cambios** en esta sesión.
- `alumnos_update_staff_mismo_plantel`: misma restricción de rol que el
  INSERT, para futuras ediciones (`USING` y `WITH CHECK` ambos acotados a
  `plantel_id_actual()`). No hay todavía un caso de uso de edición — la
  política se dejó lista porque no tiene costo adicional definirla junto
  con la tabla. **Sin cambios** en esta sesión.

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

### `public.grupos` / `public.inscripciones`

Base del bounded context "Grupos" (ver detalle completo, incluidas las
políticas RLS y el porqué de cada una, en la sección "Grupos" de Bounded
contexts, arriba). Definidas en
`supabase/migrations/20260823003328_grupos_e_inscripciones.sql`.
`docente_id` en `grupos` es la nueva fuente de verdad de "qué puede
calificar/tomar asistencia un docente", en reemplazo de la retirada
`public.docente_materias`
(`supabase/migrations/20260823003340_retirar_docente_materias.sql`).

### `public.calificaciones`

Registro de calificaciones por alumno/**grupo**, definido originalmente en
`supabase/migrations/20260822184856_calificaciones_registro_y_kardex.sql` y
migrado al esquema por grupo en
`supabase/migrations/20260823003332_calificaciones_por_grupo.sql` (esa
migración borra las filas existentes antes de aplicar el esquema nuevo —
solo eran datos de desarrollo/prueba).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` por defecto |
| `plantel_id` | `uuid` | `not null`, referencia `planteles(id)`. Indexado (`idx_calificaciones_plantel_id`) |
| `alumno_id` | `uuid` | `not null`, referencia `alumnos(id)`. Indexado (`idx_calificaciones_alumno_id`) |
| `grupo_id` | `uuid` | `not null`, referencia `grupos(id)` — reemplaza a `materia_id`/`periodo` (columnas retiradas) |
| `calificacion` | `numeric(4,2)` | `not null`, `check` entre 0 y 10 |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |

Restricción `calificaciones_alumno_grupo_key` = `unique(alumno_id,
grupo_id)` — una sola calificación por alumno/grupo, es la que habilita el
patrón de `upsert` del caso de uso en vez de `insert`.

RLS habilitada. Tres políticas — **reemplazadas** (drop + create) en
`supabase/migrations/20260823003332_calificaciones_por_grupo.sql` para
acotar a `docente` por titularidad del grupo (`grupos.docente_id`) en vez de
`docente_materias` (retirada), y para exigir que el alumno esté inscrito en
el grupo — ver detalle completo del diseño y el porqué en la sección
"Grupos" de Bounded contexts, arriba, y en la sección "Calificaciones".

**Cubierta desde el primer commit** por
`tests/aislamiento-calificaciones.test.ts` (CLAUDE.md 4.3) — ver/no-ver
calificación ajena, spoofing de `plantel_id` rechazado por RLS, migrado al
esquema por grupo — y, para la restricción por titularidad docente<->grupo
específicamente, por `tests/aislamiento-grupos.test.ts`.

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

**CI (GitHub Actions) — resuelto (2026-08-22)**: `.github/workflows/ci.yml`
corre `npm ci`, `npm run lint`, `npm run build` y `npm test` en cada
push/PR a `main`. Las credenciales `anon` que requiere `npm test` ya se
exponen como secrets del repo (`NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_ANON_KEY`), como quedó pendiente en la adenda de
ADR-0001 arriba enlazada. Detalle de configuración en
[SETUP.md](SETUP.md#ci-github-actions). Inactivo hasta que exista un remoto
en GitHub — ver `memory/CONTEXT.md`.

**Cómo correr los tests**: `npm test` (requiere `.env.local` con
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto de
desarrollo). Archivos: `tests/aislamiento-multitenant.test.ts` (planteles,
perfiles, alumnos), `tests/aislamiento-calificaciones.test.ts` (materias,
calificaciones — nuevo archivo en vez de extender el existente, para no
mezclar los casos de un módulo con los de otro, pero reusando el mismo
helper), `tests/aislamiento-asistencia.test.ts`, `tests/aislamiento-avisos.test.ts`,
`tests/aislamiento-invitaciones.test.ts`, `tests/aislamiento-alumnos.test.ts`
(aislamiento **dentro** del mismo tenant — a diferencia del resto del suite,
que verifica aislamiento **entre** tenants, este archivo verifica que una
cuenta con rol `alumno` no vea las calificaciones/asistencia de otro alumno
de su propio plantel; cubre también que staff siga viendo todo su plantel
sin cambios, ver
supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql),
`tests/aislamiento-grupos.test.ts` (titularidad docente<->grupo, ver sección
"Grupos" en Bounded contexts — reemplaza a `tests/aislamiento-docente-
materias.test.ts`, retirado junto con `docente_materias`; otro caso de
aislamiento **dentro** del mismo tenant: un docente titular de un grupo
puede calificar/tomar asistencia de alumnos inscritos ahí, el mismo docente
no puede hacerlo en un grupo donde no es titular, un alumno no inscrito no
puede recibir calificación/asistencia en ningún grupo -ni siquiera vía
staff-, y staff no cambia; usa la misma cuenta de docente de prueba que el
archivo retirado, `test-docente-materias@controlescolar.test`, distinta de
la de `aislamiento-invitaciones.test.ts` para no competir entre workers),
`tests/helpers/cuenta-prueba.ts` (helper idempotente de alta/login de
cuentas de prueba, reutilizado sin cambios por todos los archivos —
`aislamiento-alumnos.test.ts` no lo extendió: siguió el mismo patrón inline
de `aislamiento-invitaciones.test.ts` para dar de alta su cuenta adicional
con rol `alumno`, sin necesidad de tocar el helper compartido),
`vitest.config.mts` + `tests/setup.ts` (carga de env y polyfill de
`WebSocket`, requerido por `@supabase/supabase-js` en Node 20).

Nota sobre orden de ejecución: cada archivo de test de Vitest corre en su
propio proceso/worker, así que `tests/aislamiento-calificaciones.test.ts` no
asume que `tests/aislamiento-multitenant.test.ts` ya corrió — dan de alta su
propio alumno de prueba (`TEST-A-001`) de forma idempotente si todavía no
existe, en vez de depender de un orden entre archivos.
`tests/aislamiento-alumnos.test.ts` usa matrículas propias
(`TEST-A-ALUMNO-VINCULADO`, `TEST-A-002`), distintas de `TEST-A-001`, para no
interferir con los datos de los demás archivos.

## Diagrama de capas

_Pendiente._
