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

## Próximo paso

Con la arquitectura y el stack ya validados, el siguiente paso natural es
empezar a inicializar el repo (Next.js + TypeScript) y el proyecto de
Supabase, antes de tocar el primer caso de uso del MVP (probablemente
Alumnos, por ser la base de la que dependen Calificaciones y Asistencia).
