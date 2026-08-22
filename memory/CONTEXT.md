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

## Próximo paso

Con Identidad/Roles, Alumnos y Calificaciones/Kardex mínimos funcionando,
el siguiente paso natural es Asistencia (depende de Alumnos igual que
Calificaciones) o Comunicación, o configurar los tests de aislamiento en CI
(GitHub Actions) — pendiente no bloqueante desde la sesión anterior.
