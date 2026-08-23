# Contexto de negocio — Plataforma de Control Escolar

> Este archivo resume el "por qué" del proyecto para que cualquier agente (o
> Jesús en unos meses) entienda el contexto sin releer todo el código.
> Detalle completo de principios y stack: [/CLAUDE.md](../CLAUDE.md).
> Historial completo de decisiones de diseño: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
> y [docs/adr/](../docs/adr/). Este archivo es un resumen de estado, no un
> log — se reescribe/condensa cuando crece demasiado, en vez de acumular
> entradas indefinidamente (la última limpieza fue 2026-08-22).

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

## Estado actual (2026-08-22)

**Oleada 1 del MVP completa** (CLAUDE.md sección 3), los cinco módulos
funcionando de punta a punta y verificados en navegador:

- **Identidad/Roles**: login/registro con Supabase Auth, alta del primer
  plantel+usuario, sistema de invitaciones para dar de alta docentes/
  alumnos/administrativos adicionales a un plantel existente, portales
  diferenciados por rol.
- **Alumnos**: inscripción y expediente básico, con datos sensibles
  (contacto de tutor, información médica) cifrados en reposo.
- **Grupos** (Oleada 2, "horarios/carga académica" acotado a su mínimo, tras
  una plática de alcance explícita): un alumno se inscribe individualmente a
  "grupos" (`/plantel/grupos`, staff — instancia concreta de una materia
  impartida por un docente en un periodo, estilo universidad, varios grupos
  por alumno), no un solo grupo fijo tipo primaria. Reemplaza por completo la
  asignación docente<->materia general (`docente_materias`, retirada): ahora
  un docente se asigna directamente a un grupo (`grupos.docente_id`).
- **Calificaciones/Kardex**: catálogo de materias, registro de
  calificaciones por alumno/**grupo** (ya no materia/periodo directo) —
  exige que el alumno esté inscrito en el grupo, kardex con promedio.
- **Asistencia**: se toma **por sesión de grupo** (ya no diaria general del
  plantel) — un alumno puede tener asistencia distinta en dos materias el
  mismo día; el docente solo captura en los grupos donde es titular.
- **Comunicación**: tablón de avisos interno (sin envío real de correo/SMS
  todavía).

4 migraciones nuevas pendientes de aplicar manualmente en Supabase, EN ESTE
ORDEN: `20260823003328_grupos_e_inscripciones.sql`,
`20260823003332_calificaciones_por_grupo.sql`,
`20260823003336_asistencia_por_grupo.sql`,
`20260823003340_retirar_docente_materias.sql`. Las dos de en medio **borran
las filas existentes** de `calificaciones`/`asistencias` antes de aplicar el
esquema nuevo (no había forma de resolver retroactivamente a qué grupo
pertenecía cada fila vieja) — aceptable porque solo eran datos de
desarrollo/prueba ("Plantel de Prueba"), pero implica recrear esos datos de
prueba después de aplicar la migración.

**Cumplimiento LFPDPPP mínimo también completo** (CLAUDE.md 4.4): cifrado en
reposo (AES-256-GCM en capa de aplicación, la clave nunca vive en Postgres),
aviso de privacidad formal (`/aviso-privacidad`, aceptación obligatoria en
`/registro`), y derechos ARCO operables como caso de uso real
(`/derechos-arco` + `/plantel/solicitudes-arco`).

**Infraestructura**: CI activo en GitHub Actions
(`github.com/JesusTics/control-escolar`, corre en cada push/PR a `main` —
lint + build + test, tres secrets configurados: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CIFRADO_CLAVE`). 18 migraciones en
`supabase/migrations/`; todas aplicadas manualmente en el proyecto Supabase
de desarrollo excepto las últimas 5 (desde
`20260823000049_asignacion_docente_materia.sql` hasta
`20260823003340_retirar_docente_materias.sql`, deben aplicarse en ese orden
exacto — ver "Pendientes conocidos" abajo). No hay CLI de Supabase
vinculado (decisión documentada en ADR-0001). `npm test` tiene archivos que
fallan a propósito hasta que se apliquen esas migraciones pendientes
(`tests/aislamiento-grupos.test.ts`, `tests/aislamiento-calificaciones.test.ts`,
`tests/aislamiento-asistencia.test.ts`, y parte de
`tests/aislamiento-alumnos.test.ts`), incluyendo aislamiento multi-tenant
corriendo contra el proyecto Supabase real (no Docker, no SQL Editor — ver
adenda de testing del ADR-0001). `docs/SETUP.md` completo para levantar el
proyecto desde cero.

**Decisiones de diseño clave** (detalle completo en ADR-0001 y
ARCHITECTURE.md, no lo repitas aquí si necesitas el razonamiento):

- Hexagonal ligero solo donde hay lógica de negocio real o integración
  externa real — no en todo el proyecto.
- RLS obligatoria por tabla, `service_role` nunca en el flujo de usuario.
- Cifrado de campos sensibles en capa de aplicación (no `pgcrypto`/Vault).
- Confirmación de email desactivada en el proyecto de Supabase de
  desarrollo (decisión del usuario, no técnica) — el código soporta ambos
  modos.

## Pendientes conocidos (no bloqueantes)

- **Expediente completo de alumno**: solo tres campos sensibles cifrados
  (tutor, info médica) — sigue fuera de alcance un expediente más amplio.
- **Despliegue en Vercel**: no configurado todavía.
- **`CIFRADO_CLAVE`**: generar una distinta por entorno (desarrollo, CI,
  eventual producción) — nunca reusar la misma.
- **Las 4 migraciones de Grupos sin aplicar** (ver arriba): hasta que se
  apliquen manualmente en Supabase, en orden, la tabla `public.grupos` no
  existe todavía y `tests/aislamiento-grupos.test.ts`,
  `tests/aislamiento-calificaciones.test.ts`,
  `tests/aislamiento-asistencia.test.ts` y las secciones de
  `tests/aislamiento-alumnos.test.ts` que dependen de grupos fallan — es
  esperado, no una regresión (mismo patrón que migraciones anteriores).

## Próximo paso

**Oleada 2** (CLAUDE.md sección 8) ya arrancó: "horarios/carga académica" se
resolvió a su mínimo con el bounded context Grupos (ver arriba), tras una
plática de alcance explícita con el usuario. Cobranza/pagos en línea y
tickets de soporte interno siguen sin discutirse a fondo — no arrancar
código de esos dos sin una plática de alcance primero, mismo criterio que
se siguió para Grupos.
