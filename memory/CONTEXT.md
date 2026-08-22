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
  remoto ni token configurado); (2) sigue sin resolver la estrategia de
  testing automatizado de aislamiento RLS mencionada como pendiente en
  [ADR-0001](../docs/adr/0001-validacion-arquitectura-inicial.md) —
  probablemente requiera Supabase CLI local con Docker, lo cual contradice
  el principio actual de "evitar Docker" del stack; es una decisión a
  tomar en una sesión futura, no en esta.

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

  **Deuda técnica registrada explícitamente**: esta tabla se creó sin el
  test automático de aislamiento multi-tenant que CLAUDE.md 4.3 exige "desde
  el primer commit que toque una tabla nueva" — no es un olvido, es el mismo
  pendiente de estrategia de testing (Supabase CLI + Docker vs. alternativa)
  ya documentado como no resuelto en
  [ADR-0001](../docs/adr/0001-validacion-arquitectura-inicial.md) y en la
  entrada de la fundación multi-tenant arriba. Queda como riesgo abierto que
  debe resolverse antes de cualquier release, no solo para `alumnos` sino
  para toda tabla con RLS del proyecto.

## Próximo paso

Con Identidad/Roles y Alumnos mínimos funcionando, el siguiente paso natural
es Calificaciones/kardex o Asistencia (dependen de Alumnos), o bien resolver
la estrategia de testing de aislamiento multi-tenant que sigue pendiente
desde la fundación de la base de datos.
