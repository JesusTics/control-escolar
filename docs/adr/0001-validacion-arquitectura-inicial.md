# ADR-0001: Validación de arquitectura y stack inicial

- **Estado**: Aceptado
- **Fecha**: 2026-08-22

## Contexto

Las reglas de arquitectura y el stack de infraestructura del proyecto
(secciones 4 y 6 de [/CLAUDE.md](../../CLAUDE.md)) se definieron en una
plática de planeación previa, sin código escrito todavía. Antes de empezar
a implementar, se pidió una validación crítica usando dos agentes
independientes vía Claude Code:

1. Uno enfocado en los principios de arquitectura de software (hexagonal +
   DDD ligero, SOLID, multi-tenancy, LFPDPPP).
2. Uno enfocado en el stack de infraestructura (Next.js, Supabase, Vercel,
   pgvector, Claude API) — costos, cumplimiento, vendor lock-in,
   alternativas.

Ambos con instrucción de dar recomendación concreta (mantener / ajustar /
eliminar) por punto, priorizando datos verificables sobre opinión.

## Decisión

Se aceptan la mayoría de las decisiones originales, con los siguientes
ajustes (ya aplicados en `/CLAUDE.md`):

### Arquitectura

| Punto | Decisión original | Ajuste aplicado | Razón |
|---|---|---|---|
| Hexagonal + DDD | Aplicar en todos los módulos desde el día 1 | Aplicar solo donde hay lógica de negocio no trivial o integración externa real; CRUD simple accede directo a Supabase | Con un solo desarrollador, abstraer una dependencia con una única implementación real es ceremonia sin beneficio; el costo se paga en velocidad de entrega del MVP |
| Regla O/L | Nunca modificar código existente al agregar oleadas | Modificar está permitido y esperado cuando el dominio lo exige, con tests de regresión | Regla dogmática es poco realista (ej. cobranza en Oleada 2 necesita tocar Alumnos); lleva a parches y duplicación si se sigue al pie de la letra |
| Multi-tenancy (RLS + `plantel_id`) | Mantenida sin cambios de fondo | Se agregan mitigaciones explícitas: `service_role` nunca en flujo de usuario, RLS obligatoria por CI, tests contra SDK cliente (no SQL Editor), índices en columnas de política | RLS mal configurado es la única superficie donde un bug filtra datos de una institución completa a otra — es el riesgo #1 del proyecto a 6 meses |
| LFPDPPP | Minimización, control de acceso, bitácora | Se agregan: aviso de privacidad formal, derechos ARCO operables, cifrado en reposo para campos sensibles, interés superior del menor explícito | La bitácora de accesos es necesaria pero no suficiente frente a la ley; más barato resolverlo en el modelo de datos ahora que después |

### Infraestructura

| Punto | Evaluación | Decisión |
|---|---|---|
| Next.js + Supabase + Vercel, datos de menores | LFPDPPP no exige residencia física en México (solo DPA con el tercero); el riesgo es de percepción comercial con instituciones conservadoras, no legal | Mantener el stack. Fijar región `sa-east-1`/`gru1` (São Paulo, la más cercana a México en ambos proveedores) en vez del default en EE.UU. |
| pgvector para RAG institucional | Suficiente hasta ~10-20M vectores; el volumen esperado (reglamentos/manuales de una red de planteles) es órdenes de magnitud menor | Mantener. Reevaluar (`pgvectorscale` como paso intermedio) solo si se agrega RAG sobre contenido documental masivo (ej. todo el expediente histórico con OCR) |
| Costos | MVP (1 plantel) ≈ $45-55 USD/mes. Red mediana (~10 planteles) ≈ $400-900 USD/mes. Riesgo de sorpresa: egress y PITR de Supabase | Aceptado como parte del presupuesto del proyecto. Configurar alertas de uso desde el día 1 |
| Vendor lock-in | Postgres es portable; el lock-in real está en Supabase Auth (GoTrue) y políticas RLS que referencian `auth.uid()` | Mantener la arquitectura hexagonal para la capa de datos (`IStudentRepository`, etc.); no invertir esfuerzo en abstraer Auth — aceptar esa dependencia conscientemente |
| Alternativa: AWS `mx-central-1` (Querétaro) | Única opción con residencia física real en México hoy; ningún competidor del nicho probablemente la usa (argumento de venta) | Evaluar como opción de Oleada 2+ si un cliente institucional grande la exige contractualmente. No se adopta para el MVP — contradice el principio de "sin infraestructura propia" para un equipo de una persona |
| Alternativa: self-hosted Supabase en VPS | Mismo DX, control total de residencia | Descartada para el MVP — el equipo de una persona no puede cargar con backups/parches/HA propios |

## Consecuencias

- El MVP se implementa más rápido al no forzar hexagonal en módulos CRUD
  simples, a costa de que esos módulos sean algo más difíciles de migrar de
  proveedor si eso llegara a ser necesario (riesgo aceptado — no es
  prioridad para el MVP).
- Los tests de aislamiento multi-tenant y las reglas de CI para RLS
  obligatoria se vuelven bloqueantes desde el primer PR que toque una tabla
  nueva, no una tarea pendiente para después del MVP.
- El modelo de datos y los flujos de Alumnos deben contemplar aviso de
  privacidad y derechos ARCO desde el diseño inicial del módulo, no como
  feature posterior.
- Se fija la región de Supabase/Vercel en Sudamérica (`sa-east-1`/`gru1`)
  desde la configuración inicial del proyecto.
- Queda documentado AWS `mx-central-1` como opción de escape si aparece un
  requisito contractual de residencia física en México en Oleada 2+.

## Fuentes usadas en la validación

- Supabase RLS Best Practices — makerkit.dev
- Supabase Security Best Practices: RLS, API Keys & CVE-2025-48757 —
  vibeappscanner.com
- Row Level Security — supabase.com/docs
- Aviso de privacidad México 2026: LFPDPPP — legiscope.com
- Protección de datos personales en México: obligaciones LFPDPPP 2025 —
  aeabogados.com
