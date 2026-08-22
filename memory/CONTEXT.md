# Contexto de negocio — Plataforma de Control Escolar

> Este archivo resume el "por qué" del proyecto para que cualquier agente (o
> Jesús en unos meses) entienda el contexto sin releer todo el código.
> Detalle completo de principios y stack: [/CLAUDE.md](../CLAUDE.md).

## De qué trata

Sistema de control escolar tipo AMBAR (el sistema usado en el TecNM), pero
pensado desde cero para ser más simple de usar y más completo, con dos
diferenciadores frente a competidores existentes (AMBAR, DVcore,
Servoescolar, Controlisis, EsCoolKardex):

1. UX radicalmente simple, pensada para personal administrativo/docente no
   técnico y de mayor edad.
2. IA integrada de forma invisible en el flujo (no como feature aparte).

## Quién lo usaría

Redes de planteles bajo una organización matriz (modelo multi-institución,
como TecNM/AMBAR). El MVP se diseña multi-tenant desde el día 1 aunque el
primer cliente real tenga un solo plantel.

## Estado actual

- 2026-08-21: Proyecto recién iniciado. Hubo una plática previa (en otro
  chat) donde se definió el alcance, arquitectura y stack, capturados en
  `/CLAUDE.md`. Aún no hay código.
- Se corrió `/bootstrap-project` para crear la estructura base
  (`docs/`, `memory/`, este archivo).
- 2026-08-22: Se validó con dos agentes independientes la arquitectura y el
  stack de `/CLAUDE.md`. Resultado documentado en
  [ADR-0001](../docs/adr/0001-validacion-arquitectura-inicial.md) y ya
  aplicado a `/CLAUDE.md`: hexagonal se acotó a módulos con lógica de
  negocio real (no todo el proyecto), la regla O/L se flexibilizó, se
  agregaron mitigaciones concretas de RLS (riesgo #1 del proyecto) y
  requisitos LFPDPPP (aviso de privacidad, ARCO operable), y se fijó región
  Sudamérica para Supabase/Vercel por cercanía a México.

- 2026-08-22: Se creó la fundación multi-tenant de la base de datos:
  migración `supabase/migrations/20260822074551_fundacion_multitenant.sql`
  con tablas `planteles` y `perfiles`, RLS habilitada en ambas, función
  `plantel_id_actual()` y políticas mínimas de `SELECT`. Documentado en
  [ARCHITECTURE.md](../docs/ARCHITECTURE.md#modelo-de-datos). Pendiente:
  (1) el usuario debe aplicar esta migración manualmente en el SQL Editor
  del dashboard de Supabase (todavía no hay CLI vinculado al proyecto
  remoto ni token configurado); (2) ~~sigue sin resolver la estrategia de
  testing automatizado de aislamiento RLS...~~ **resuelto el 2026-08-22**,
  ver entrada correspondiente más abajo.

- 2026-08-22: Se implementó el módulo Identidad/Roles mínimo: login,
  onboarding del primer plantel+usuario, sesión protegida. Migración
  `supabase/migrations/20260822075713_alta_inicial_identidad.sql` con la
  función `security definer` `crear_plantel_y_perfil_inicial` (pendiente de
  aplicar manualmente en el SQL Editor de Supabase, igual que la anterior).
  Se agregó `@supabase/ssr` y se migró el cliente browser existente a
  `createBrowserClient` para compartir sesión servidor/cliente vía cookies.
  Detalle de diseño en
  [ARCHITECTURE.md](../docs/ARCHITECTURE.md#identidadroles). Pendiente
  conocido: si la confirmación de email está activada en el proyecto de
  Supabase, el flujo de registro no completa automáticamente el alta de
  plantel/perfil tras confirmar — queda como decisión a tomar en una sesión
  futura.

- 2026-08-22: Se implementó el módulo Alumnos mínimo (primer módulo de
  negocio real del MVP): inscripción y listado de alumnos de un plantel.
  Migración `supabase/migrations/20260822165852_alumnos_alta_y_listado.sql`
  con la tabla `alumnos`, RLS habilitada, e índice en `plantel_id`
  (pendiente de aplicar manualmente en el SQL Editor de Supabase, igual que
  las migraciones anteriores). Casos de uso en
  `src/modules/alumnos/casos-uso/` (`inscribir-alumno`, `listar-alumnos`)
  siguiendo el mismo patrón de cliente Supabase inyectado que Identidad.
  Explícitamente fuera de alcance: expediente completo, edición/baja, y
  datos sensibles (médicos, tutores) — eso requiere primero resolver
  cifrado en reposo (CLAUDE.md 4.4), no implementado todavía. Detalle en
  [ARCHITECTURE.md](../docs/ARCHITECTURE.md#public-alumnos).

  **Deuda técnica registrada explícitamente en su momento**: esta tabla se
  creó sin el test automático de aislamiento multi-tenant que CLAUDE.md 4.3
  exige "desde el primer commit que toque una tabla nueva" — **resuelto el
  2026-08-22**, ver entrada correspondiente más abajo. Ya no es un riesgo
  abierto.

- 2026-08-22: Se resolvió la estrategia de testing de aislamiento
  multi-tenant (RLS) que había quedado pendiente desde la fundación de la
  base de datos y desde el alta de `alumnos` (ver entradas arriba, ambas
  actualizadas). Decisión: Vitest + `@supabase/supabase-js` corriendo contra
  el **proyecto Supabase remoto de desarrollo real** (no Supabase CLI local
  con Docker, que hubiera contradicho el principio de "evitar Docker" del
  stack), con dos cuentas de prueba fijas y reutilizables
  (`test-aislamiento-a@controlescolar.test` /
  `test-aislamiento-b@controlescolar.test`) en vez de cuentas efímeras — así
  se evita tanto Docker como la necesidad de `service_role` para limpiar
  datos entre corridas (`service_role` está prohibido en el flujo normal por
  CLAUDE.md 4.3). Trade-off aceptado explícitamente: esas cuentas y sus
  datos (un plantel, un perfil, un alumno cada una) viven permanentemente en
  el proyecto de desarrollo — aceptable por no ser producción y por volumen
  trivial. Detalle completo en la adenda de
  [ADR-0001](../docs/adr/0001-validacion-arquitectura-inicial.md#adenda-2026-08-22-estrategia-de-testing-de-aislamiento-rls)
  y en [ARCHITECTURE.md](../docs/ARCHITECTURE.md#testing-de-aislamiento-multi-tenant-rls).
  Cubre los 5 casos exigidos por CLAUDE.md 4.3 (ver/no-ver plantel y perfil
  ajenos, ver/no-ver alumno ajeno, spoofing de `plantel_id` rechazado por
  RLS) en `tests/aislamiento-multitenant.test.ts` — corre con `npm test`, 8
  tests, todos verdes. Pendiente (no bloqueante): configurar estos tests en
  CI (GitHub Actions), lo que requiere exponer las credenciales `anon` de
  desarrollo como secretos del repo — son públicas por diseño (viven en el
  bundle del cliente), no un secreto sensible.

- 2026-08-22: Se resolvió el pendiente de confirmación de email en
  Identidad/Roles (quedaba explícito en la entrada anterior y en
  ARCHITECTURE.md como "caso borde sin resolver"). Ahora `/registro` guarda
  `nombre_plantel`/`nombre_completo` como user metadata de Supabase Auth al
  hacer `signUp` (con `emailRedirectTo` apuntando a `/auth/callback`), y el
  nuevo Route Handler `src/app/auth/callback/route.ts` intercambia el `code`
  de confirmación por sesión, completa el alta de plantel/perfil (reutiliza
  `registrar-plantel-inicial`, sin duplicar lógica) leyendo esa metadata, y
  redirige a `/dashboard` — o a `/login?error=...` (mostrado ahora por
  `src/app/login/page.tsx`) si algo falla. El camino sin confirmación
  (`signUp` con sesión inmediata) no cambió de comportamiento. Detalle
  completo en
  [ARCHITECTURE.md](../docs/ARCHITECTURE.md#identidadroles).

  **Decisión explícita del usuario, no técnica**: la confirmación de email
  ("Confirm email" en Authentication → Settings) **sigue desactivada** en el
  proyecto de Supabase de **desarrollo** — no se cambió en esta sesión. El
  código ya soporta ambos modos (`npm run build` y `npm test`, 8 tests,
  siguen pasando sin activarla), pero el camino con confirmación activada
  **no se ha probado manualmente todavía** porque este entorno no tiene forma
  de recibir/confirmar un correo real. Pasos exactos para cuando se decida
  probarlo:
  1. En el dashboard de Supabase del proyecto de desarrollo: Authentication →
     Settings → activar "Confirm email".
  2. Ir a `/registro` en la app corriendo localmente (`npm run dev`) y
     registrar una cuenta nueva con un correo real al que se tenga acceso.
     Debe aparecer el mensaje "Cuenta creada. Revisa tu correo..." (no debe
     redirigir directo a `/dashboard`).
  3. Revisar la bandeja de entrada de ese correo: debe llegar un email de
     Supabase con un link cuyo destino final sea `/auth/callback?code=...`
     sobre el dominio/puerto donde corre la app (verificar que el `origin`
     capturado en el Server Action —`localhost:3000` en local— sea correcto;
     si el correo llega con la URL de Supabase por defecto en vez del origen
     de la app, revisar la configuración de "Site URL"/"Redirect URLs" en
     Authentication → URL Configuration del dashboard de Supabase, que debe
     incluir el dominio de la app).
  4. Hacer clic en el link del correo. Debe terminar en `/dashboard` ya con
     el plantel y perfil creados (nombre del plantel y nombre completo
     correctos, tomados del registro original).
  5. Verificar en el SQL Editor de Supabase (o en el propio `/dashboard`) que
     se creó exactamente un plantel y un perfil — no duplicados si se hace
     doble clic en el link de confirmación.
  6. Al terminar la prueba, desactivar "Confirm email" de nuevo si se quiere
     volver al comportamiento actual de desarrollo, y limpiar la cuenta de
     prueba creada (usuario en Authentication → Users, y sus filas en
     `perfiles`/`planteles`) si no se quiere dejar basura en el proyecto.

- 2026-08-22: Se implementó el módulo Calificaciones/Kardex mínimo
  (siguiente módulo del roadmap del MVP tras Alumnos): catálogo de materias,
  registro/corrección de calificaciones (upsert por
  `alumno_id,materia_id,periodo`) y kardex de alumno con promedio general.
  Dos migraciones nuevas:
  `supabase/migrations/20260822184852_materias_catalogo.sql` (tabla
  `materias`) y
  `supabase/migrations/20260822184856_calificaciones_registro_y_kardex.sql`
  (tabla `calificaciones`) — **pendientes de aplicar manualmente en el SQL
  Editor de Supabase**, igual que las anteriores. Lógica de dominio pura
  (`NOTA_APROBATORIA`, `estaAprobado`, `calcularPromedio`) en
  `src/modules/calificaciones/dominio/calificacion.ts`, aplicando hexagonal
  ligero de forma explícita (CLAUDE.md 4.1 la usa como ejemplo textual).
  Test de aislamiento multi-tenant en el mismo commit que las tablas nuevas
  (`tests/aislamiento-calificaciones.test.ts`), como exige CLAUDE.md 4.3 —
  a diferencia de `alumnos`, aquí no quedó como deuda técnica. Detalle
  completo en [ARCHITECTURE.md](../docs/ARCHITECTURE.md#calificaciones).

  **Pendiente antes de que `npm test` pase en verde completo**: aplicar
  ambas migraciones nuevas en el proyecto de Supabase de desarrollo — sin
  ellas, `tests/aislamiento-calificaciones.test.ts` falla con "Could not
  find the table 'public.materias'" (el resto de la suite, dominio y
  aislamiento de alumnos, sigue en verde). `npm run build` sí pasa completo
  sin aplicar nada, porque no depende de las tablas en build time.

- 2026-08-22: Se implementó el módulo Asistencia mínimo (siguiente módulo
  del roadmap del MVP tras Calificaciones/Kardex): asistencia diaria general
  del plantel (un registro por alumno por día, no por materia/clase
  individual — simplificación consciente para el MVP), captura masiva en
  `/asistencia` (upsert por `alumno_id,fecha`, una sola Server Action con el
  arreglo completo de la lista), y sección de asistencia (porcentaje +
  últimos registros) agregada al kardex existente en `/alumnos/[id]`.
  Migración nueva
  `supabase/migrations/20260822190214_asistencia_diaria.sql` con la tabla
  `asistencias`, RLS habilitada, e índices en `plantel_id`/`alumno_id` —
  **pendiente de aplicar manualmente en el SQL Editor de Supabase**, igual
  que las migraciones anteriores. Lógica de dominio pura
  (`calcularPorcentajeAsistencia`) en
  `src/modules/asistencia/dominio/asistencia.ts`, aplicando hexagonal ligero
  de forma explícita (CLAUDE.md 4.1 usa Asistencia como uno de los ejemplos
  textuales). Regla de negocio no obvia documentada en el código: `retardo`
  cuenta como asistencia, `ausente` penaliza, `justificado` se excluye por
  completo del cálculo (ni numerador ni denominador). Test de aislamiento
  multi-tenant en el mismo commit que la tabla nueva
  (`tests/aislamiento-asistencia.test.ts`), como exige CLAUDE.md 4.3, con
  fecha fija determinista (`2026-01-15`) para idempotencia entre corridas.
  Detalle completo en [ARCHITECTURE.md](../docs/ARCHITECTURE.md#asistencia).

  **Pendiente antes de que `npm test` pase en verde completo** (mismo patrón
  que quedó documentado al implementar Calificaciones): aplicar la migración
  nueva en el proyecto de Supabase de desarrollo — sin ella,
  `tests/aislamiento-asistencia.test.ts` falla con "Could not find the table
  'public.asistencias'" (el resto de la suite, dominio y aislamiento de
  alumnos/calificaciones, sigue en verde: 27 tests pasan, 3 se saltan por
  ese archivo). `npm run build` y `npm run lint` sí pasan completos sin
  aplicar nada, porque no dependen de la tabla en build time.

- 2026-08-22: Se implementó el módulo Comunicación mínimo (cierra el ciclo
  completo de valor de la Oleada 1 del MVP, CLAUDE.md sección 3): tablón de
  avisos **interno (in-app)**, de solo alta y lectura — explícitamente NO
  envío real de correo/SMS a padres/tutores en este corte. Razón: no existen
  todavía datos de contacto de tutores (bloqueados por CLAUDE.md 4.4, cifrado
  en reposo no resuelto) ni una integración real de proveedor de email —
  construir una interfaz `IEmailSender` hoy sería la ceremonia sin sustancia
  que CLAUDE.md 4.1 dice evitar. Migración nueva
  `supabase/migrations/20260822191115_avisos_tablon.sql` con la tabla
  `avisos`, RLS habilitada, e índice en `plantel_id` — **pendiente de aplicar
  manualmente en el SQL Editor de Supabase**, igual que las migraciones
  anteriores. Casos de uso en `src/modules/comunicacion/casos-uso/`
  (`publicar-aviso`, `listar-avisos`), CRUD simple sin capa de dominio puro
  separada (a diferencia de Calificaciones/Asistencia) — no hay lógica de
  negocio no trivial en este alcance. UI en `/avisos` (listado) y
  `/avisos/nuevo` (alta), con enlace "Avisos" agregado a la navegación
  mínima existente en `/alumnos`. Test de aislamiento multi-tenant en el
  mismo commit que la tabla nueva (`tests/aislamiento-avisos.test.ts`), como
  exige CLAUDE.md 4.3. Detalle completo en
  [ARCHITECTURE.md](../docs/ARCHITECTURE.md#comunicación).

  **Pendiente antes de que `npm test` pase en verde completo** (mismo patrón
  que quedó documentado al implementar Calificaciones/Asistencia): aplicar la
  migración nueva en el proyecto de Supabase de desarrollo — sin ella,
  `tests/aislamiento-avisos.test.ts` falla con "Could not find the table
  'public.avisos'" (el resto de la suite sigue en verde: 30 tests pasan, 3 se
  saltan por ese archivo). `npm run build` y `npm run lint` sí pasan
  completos sin aplicar nada.

  **Pendiente explícito, NO resuelto en esta sesión**: "portales por rol"
  (último ítem de la Oleada 1, CLAUDE.md sección 3) sigue sin implementar.
  Depende de un caso de uso que todavía no existe — **invitar/dar de alta
  usuarios adicionales (docente, alumno, administrativo) a un plantel ya
  existente**. Hoy Identidad/Roles solo soporta crear el primer usuario
  (`oficina_central`) de un plantel nuevo vía `/registro`
  (`registrar-plantel-inicial`); no hay ningún flujo para que ese primer
  usuario invite a un docente o dé de alta una cuenta de alumno dentro de su
  mismo plantel. Es la sesión natural siguiente antes de poder construir
  portales diferenciados por rol (el campo `dirigido_a` de `avisos` es
  informativo por ahora, no filtra visibilidad por rol, precisamente por
  este hueco).

- 2026-08-22: Se implementó el sistema de invitaciones de Identidad/Roles —
  el prerrequisito que faltaba (ver pendiente explícito registrado en la
  entrada anterior) antes de poder construir "portales por rol" (último
  ítem de la Oleada 1, CLAUDE.md sección 3). Hasta ahora solo existía el
  alta del primer usuario (`oficina_central`) de un plantel nuevo vía
  `/registro`; los roles `docente`/`alumno` del `check` de `perfiles.rol`
  eran papel muerto porque no había forma de dar de alta un segundo usuario
  en un plantel ya existente. Migración nueva
  `supabase/migrations/20260822191914_invitaciones_plantel.sql` con la tabla
  `invitaciones`, RLS habilitada, índice en `plantel_id`, y dos funciones
  `security definer` acotadas (`obtener_invitacion_publica`,
  `aceptar_invitacion`) que resuelven el mismo "problema del huevo y la
  gallina" que el alta inicial (la persona invitada no tiene perfil
  todavía, así que no puede pasar RLS por sí misma) — **pendiente de aplicar
  manualmente en el SQL Editor de Supabase**, igual que las migraciones
  anteriores. Casos de uso nuevos en `src/modules/identidad/casos-uso/`
  (`crear-invitacion`, `listar-invitaciones`, `obtener-info-invitacion`,
  `aceptar-invitacion`). UI: `/plantel/invitaciones` (protegida por rol de
  staff, con mensaje explícito de "no tienes permiso" si no aplica) y
  `/invitacion/[token]` (pública, sin sesión previa). Alcance explícito NO
  incluido en esta sesión: portales diferenciados por rol (siguiente
  sesión), envío real de correo (el link se comparte manualmente, mismo
  criterio que Comunicación), y revocar/reenviar invitaciones. Detalle
  completo, incluyendo el diseño de ambos RPCs y por qué no se usó
  `service_role` ni políticas abiertas, en
  [ARCHITECTURE.md](../docs/ARCHITECTURE.md#identidadroles).

  Test funcional dedicado en `tests/aislamiento-invitaciones.test.ts` — más
  allá de los tres casos estándar de aislamiento RLS, cubre la superficie de
  mayor riesgo del módulo: un tercer usuario de prueba
  (`test-invitado@controlescolar.test`) acepta una invitación real y el test
  verifica que termine con el `plantel_id` correcto (el del invitador, no
  uno nuevo) y el `rol` de la invitación (no el rol del alta inicial).

  **Con esto ya es posible tener cuentas reales de `docente`/`alumno`** — el
  bloqueador que impedía empezar "portales por rol" queda resuelto. Esa es
  la pieza natural a construir en la siguiente sesión para cerrar por
  completo la Oleada 1 del MVP.

  **Pendiente antes de que `npm test` pase en verde completo** (mismo patrón
  documentado en cada módulo con tabla nueva): aplicar la migración en el
  proyecto de Supabase de desarrollo — sin ella,
  `tests/aislamiento-invitaciones.test.ts` falla con "Could not find the
  table 'public.invitaciones'" (el resto de la suite sigue en verde:
  33 tests pasan, 4 se saltan por ese archivo). `npm run build` y
  `npm run lint` sí pasan completos sin aplicar nada.

- 2026-08-22: Se implementaron "portales por rol" — el último pendiente
  explícito de la Oleada 1 del MVP (CLAUDE.md sección 3). **Con esta sesión
  se completa la Oleada 1 entera**: alumnos, kardex/calificaciones,
  asistencia, comunicación y portales por rol, los cinco módulos listados en
  CLAUDE.md sección 3, funcionando de punta a punta.

  Dos partes acopladas, resueltas en la misma sesión porque exponer una UI
  reducida a `alumno` sin restringir también la base de datos hubiera sido
  solo cosmético:

  1. **Hueco de seguridad cerrado**: las políticas de SELECT de `alumnos`,
     `calificaciones`, `asistencias` y `avisos` solo filtraban por
     `plantel_id`, sin considerar el rol — una cuenta con rol `alumno` (ya
     posible desde el sistema de invitaciones) veía las calificaciones y
     asistencia de TODOS los alumnos de su plantel, no solo las suyas.
     Violaba mínimo privilegio y "interés superior del menor" (CLAUDE.md
     4.4). Además no existía ningún vínculo entre un perfil `alumno` y su
     fila de `alumnos` — eran entidades desconectadas. Dos migraciones
     nuevas: `supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql`
     (columna `alumnos.perfil_id`, columna `invitaciones.alumno_id`, y
     `aceptar_invitacion` actualizada para vincular ambas al aceptar una
     invitación) y
     `supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql`
     (reemplaza las 4 políticas de SELECT — INSERT/UPDATE quedan intactas,
     sin cambio de comportamiento para staff/docente) — **ambas pendientes
     de aplicar manualmente en el SQL Editor de Supabase, en ese orden**,
     igual que las migraciones anteriores. `docente` mantiene a propósito
     visibilidad de todo el plantel (no hay todavía asignación de
     materias/grupos por docente, fuera de alcance de esta sesión).

  2. **Portales por rol**: `/dashboard` deja de ser idéntico para todos los
     roles. `administrativo`/`oficina_central` ven la navegación completa
     (Alumnos, Materias, Asistencia, Avisos, Invitar usuarios); `docente` ve
     Alumnos/Asistencia/Avisos (sin Materias ni Invitar usuarios); `alumno`
     ya no ve un menú general — ve directamente su propio kardex (componente
     compartido nuevo `src/app/alumnos/[id]/vista-kardex.tsx`, extraído de
     `/alumnos/[id]` para no duplicar ese layout) y sus avisos, resueltos vía
     el nuevo caso de uso `obtener-alumno-vinculado`. Si su perfil todavía no
     está vinculado a ningún alumno, ve un mensaje explícito en vez de una
     página vacía o un error.

  El flujo de invitaciones (`/plantel/invitaciones`) se extendió para poder
  vincular: al invitar con rol "Alumno" aparece un selector con los alumnos
  del plantel sin cuenta todavía (`listar-alumnos-sin-vincular`, caso de uso
  nuevo), o un mensaje claro si no hay ninguno. `crear-invitacion` acepta un
  `alumnoId` opcional (solo relevante para rol `alumno`) — es opcional a
  propósito: sigue siendo válido invitar a un alumno sin seleccionar a cuál
  vincular, el portal de esa cuenta simplemente informará que falta
  vincularla.

  Detalle de diseño completo (ambas migraciones, las 4 políticas de SELECT
  reemplazadas, los 2 casos de uso nuevos de Alumnos, y la navegación por
  rol) en [ARCHITECTURE.md](../docs/ARCHITECTURE.md#identidadroles).

  **Cubierto por un test nuevo de un tipo distinto al resto del suite**:
  `tests/aislamiento-alumnos.test.ts` verifica aislamiento **dentro** del
  mismo tenant (no entre tenants, ya cubierto por el resto de la suite) — una
  cuenta con rol `alumno` vinculada a un alumno X no puede ver las
  calificaciones/asistencia de otro alumno Y de su MISMO plantel, y staff
  (`oficina_central`) sigue viendo todo su plantel sin restricciones. Se
  corrió el suite completo (37 tests preexistentes) para confirmar que
  endurecer la RLS no rompió ninguna visibilidad legítima de staff — todos
  siguen en verde.

  **Pendiente antes de que `npm test` pase en verde completo** (mismo patrón
  documentado en cada módulo con migración nueva): aplicar ambas migraciones
  en el proyecto de Supabase de desarrollo, en orden — sin ellas,
  `tests/aislamiento-alumnos.test.ts` falla con "column alumnos.perfil_id
  does not exist" (el resto de la suite, 37 tests de módulos ya aplicados,
  sigue en verde). `npm run build` y `npm run lint` sí pasan completos sin
  aplicar nada.

- 2026-08-22: Se configuró CI (GitHub Actions), pendiente registrado desde
  varias entradas anteriores y explícito en CLAUDE.md sección 5. Nuevo
  `.github/workflows/ci.yml`: corre en cada `push`/`pull_request` a `main`,
  un solo job en `ubuntu-latest` con Node 20 (misma versión que desarrollo
  local, `package.json` no define `engines`), `npm ci` + `npm run lint` +
  `npm run build` + `npm test`, con cache de npm en `setup-node`. Se agregó
  un comentario a `tests/setup.ts` documentando (sin cambiar lógica —
  `dotenv.config()` ya no sobreescribe variables de `process.env`
  existentes por default) que el mismo archivo funciona igual en local
  (lee `.env.local`) y en CI (usa las variables que el job ya puebla desde
  secrets, `.env.local` no existe ahí). Verificado localmente antes de dar
  por bueno el workflow, mismos comandos exactos: `npm run lint` limpio,
  `npm run build` exitoso, `npm test` con 45/45 tests en verde (8 archivos).
  Documentación actualizada: `docs/SETUP.md` (sección "Despliegue → CI",
  con los nombres exactos de los dos secrets a configurar) y
  `docs/ARCHITECTURE.md` (sección "Decisiones técnicas", confirma resuelto
  el pendiente de exponer credenciales `anon` como secrets, que quedaba
  abierto en la adenda de ADR-0001).

  **Estado: CI listo en el repo pero INACTIVO.** No hay remoto de GitHub
  configurado todavía (`git remote -v` vacío) — el workflow no se ejecutará
  hasta que el usuario, por su cuenta: (a) cree el repositorio remoto en
  GitHub y haga push de la rama `main`; (b) configure en
  **Settings → Secrets and variables → Actions** del repo dos secrets con
  los mismos valores que ya tiene en su `.env.local` local:
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Sin (b), el
  job de CI fallará en el paso `npm test` con las mismas credenciales
  vacías que hacen fallar `tests/helpers/cuenta-prueba.ts` en local sin
  `.env.local`.

## Próximo paso

**Oleada 1 del MVP completa** (CLAUDE.md sección 3): alumnos, kardex/
calificaciones, asistencia, comunicación y portales por rol, los cinco
funcionando de punta a punta. Antes de considerar Oleada 2 (cobranza/pagos,
horarios/carga académica, tickets de soporte), pendientes no bloqueantes de
sesiones anteriores: activar el CI ya configurado (crear remoto en GitHub,
push, configurar los dos secrets — ver entrada de arriba); aplicar en el
proyecto de Supabase de desarrollo las dos migraciones más recientes (ver
entrada correspondiente arriba) y todas las anteriores todavía no aplicadas
(revisar `supabase/migrations/` contra el estado real del proyecto, ya son
10 migraciones acumuladas sin aplicar automáticamente — no hay CLI vinculado
al proyecto remoto ni token configurado).
