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
- **Calificaciones/Kardex**: catálogo de materias, registro de
  calificaciones, kardex con promedio.
- **Asistencia**: captura masiva diaria, porcentaje calculado por alumno.
- **Comunicación**: tablón de avisos interno (sin envío real de correo/SMS
  todavía).

**Cumplimiento LFPDPPP mínimo también completo** (CLAUDE.md 4.4): cifrado en
reposo (AES-256-GCM en capa de aplicación, la clave nunca vive en Postgres),
aviso de privacidad formal (`/aviso-privacidad`, aceptación obligatoria en
`/registro`), y derechos ARCO operables como caso de uso real
(`/derechos-arco` + `/plantel/solicitudes-arco`).

**Infraestructura**: CI activo en GitHub Actions
(`github.com/JesusTics/control-escolar`, corre en cada push/PR a `main` —
lint + build + test, tres secrets configurados: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CIFRADO_CLAVE`). 15 migraciones en
`supabase/migrations/`, todas aplicadas manualmente en el proyecto Supabase
de desarrollo (no hay CLI de Supabase vinculado — decisión documentada en
ADR-0001). 56 tests (`npm test`) en verde, incluyendo aislamiento
multi-tenant corriendo contra el proyecto Supabase real (no Docker, no
SQL Editor — ver adenda de testing del ADR-0001). `docs/SETUP.md` completo
para levantar el proyecto desde cero.

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
- **Docente sin asignación de materias/grupos**: hoy cualquier `docente` ve
  todo el plantel; no hay acotamiento por materia/grupo asignado.

## Próximo paso

Antes de tocar **Oleada 2** (cobranza/pagos, horarios/carga académica,
tickets de soporte — CLAUDE.md sección 8): falta una plática de alcance,
ninguno de los tres módulos se ha discutido a fondo todavía (a diferencia
de la Oleada 1, que sí partió de una validación de arquitectura explícita).
No arrancar código de Oleada 2 sin esa conversación primero.
