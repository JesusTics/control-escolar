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

## Adenda (2026-08-22): estrategia de testing de aislamiento RLS

Este ADR dejó documentado como pendiente "los tests de aislamiento
multi-tenant... contra el SDK cliente, nunca contra el SQL Editor" (CLAUDE.md
4.3), sin resolver el "cómo" — el enfoque obvio, Supabase CLI local con
Docker, contradice el principio de "evitar Docker" del stack (sección 6)
para un equipo de una persona.

**Decisión**: los tests de aislamiento corren con Vitest +
`@supabase/supabase-js` contra el **proyecto Supabase remoto de desarrollo
real** (las mismas credenciales `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` de
`.env.local` que usa la app), usando **cuentas de prueba fijas y
reutilizables** (`test-aislamiento-a@controlescolar.test`,
`test-aislamiento-b@controlescolar.test`) en vez de cuentas efímeras creadas
y destruidas en cada corrida. Implementado en `tests/`, correr con
`npm test`.

**Por qué cuentas fijas y no efímeras**: crear/destruir cuentas en cada
corrida requeriría `service_role` para poder limpiar datos de otro usuario al
final del test (un cliente `anon` autenticado como usuario A no puede borrar
las filas de B — la misma RLS que se está probando lo impide, correctamente).
Usar `service_role` en los tests para poder limpiar contradice el mismo
principio que se está verificando (CLAUDE.md 4.3: "`service_role` nunca se
usa en el flujo normal"). Con cuentas fijas y reutilizables no hace falta
limpiar nada: el helper (`tests/helpers/cuenta-prueba.ts`) es idempotente —
intenta iniciar sesión primero, y solo si la cuenta no existe hace `signUp` +
alta de plantel/perfil vía el mismo RPC `crear_plantel_y_perfil_inicial` que
usa la app. Los casos de negocio (ej. inscribir un alumno) usan matrículas
fijas y deterministas, tratando "ya existe de una corrida anterior" como
éxito esperado, no como fallo.

**Trade-off aceptado**: estas dos cuentas de prueba y sus datos (un plantel,
un perfil, un alumno cada una) viven **permanentemente** en el proyecto
Supabase de desarrollo — no es efímero ni se limpia solo. Se acepta porque
(a) es el proyecto de *desarrollo*, nunca producción, y (b) el volumen es
trivial (dos cuentas, un puñado de filas) y no crece con cada corrida al ser
idempotente. Esto evita meter Docker al stack **y** evita la excepción de
`service_role` en el mismo movimiento — las dos alternativas que se querían
descartar explícitamente.

**Consecuencia sobre CI**: como estos tests dependen de red real y de
credenciales de un proyecto Supabase específico, correrlos en GitHub Actions
(sección 5) requiere exponer esas credenciales `anon` (no sensibles por
diseño — son públicas en el bundle del cliente) como secretos del repo. Queda
como tarea de la configuración de CI, no bloquea esta decisión de diseño.

## Adenda (2026-08-22): cifrado de campos sensibles en capa de aplicación

CLAUDE.md 4.4 dejó pendiente, desde la plática de planeación inicial,
"cifrado en reposo para campos sensibles (datos médicos, tutores) más allá
de lo que da por default la infraestructura" — sin resolver el "cómo".
Postgres/Supabase ya cifra en reposo a nivel de disco por default; lo que
faltaba era cifrado a nivel de columna, para que ni un dump de la base ni
acceso directo al dashboard de Supabase (SQL Editor) permitieran leer estos
campos en claro.

**Alternativas consideradas**:

1. **`pgcrypto`/`pgsodium` (extensiones de Postgres)**: cifrar/descifrar
   dentro de la propia base, con funciones SQL (`pgp_sym_encrypt`, etc.).
2. **Supabase Vault**: gestión de secretos de Supabase sobre `pgsodium`,
   pensada justo para este caso de uso.
3. **Cifrado en la capa de aplicación** (Node, módulo `crypto` nativo, fuera
   de Postgres por completo).

**Decisión**: cifrado en la capa de aplicación (opción 3), con AES-256-GCM
vía el módulo `crypto` nativo de Node — sin librerías de terceros. Detalle
de implementación en `src/lib/cifrado/` y en
[ARCHITECTURE.md](../ARCHITECTURE.md#alumnos).

**Por qué no `pgcrypto`/Vault, a pesar de ser la opción "nativa" de
Postgres/Supabase**: en ambas, la clave de cifrado termina viviendo *dentro*
de la infraestructura que se supone hay que proteger — como parámetro de la
función SQL (`pgcrypto`) o como secreto gestionado por el propio proyecto de
Supabase (Vault). Alguien con acceso de `service_role`/administrador al
proyecto de Supabase (ej. un empleado del proveedor con acceso al panel
interno, o una filtración de credenciales de `service_role`) podría
potencialmente descifrar los datos sin salir de la infraestructura de
Supabase. Con cifrado en capa de aplicación, la clave (`CIFRADO_CLAVE`) vive
**exclusivamente** como variable de entorno del proceso de Next.js en
Vercel — nunca toca Supabase. Comprometer solo la base de datos (el
escenario más probable: un dump, una query mal restringida, acceso al SQL
Editor) no es suficiente para leer estos campos; hace falta comprometer
*además* el entorno de ejecución de la app.

**Costo aceptado de esta decisión**: no se puede filtrar/ordenar por estos
campos en SQL (son ciphertext, no el dato real) — irrelevante aquí, ninguno
de los tres campos (contacto de tutor, información médica) necesita
búsqueda ni orden. Tampoco se puede usarlos en una política RLS directamente
sobre su contenido — tampoco aplica: la restricción de acceso a estos
campos específicos es de autorización por rol (`administrativo`/
`oficina_central` en el caso de uso), no de contenido.

**Por qué AES-256-GCM y no un modo sin autenticación (ej. AES-CBC)**: GCM
agrega un `authTag` que detecta si el ciphertext fue manipulado antes de
descifrar — lanza un error explícito en vez de devolver datos corruptos o
manipulados en silencio. Para datos médicos y de contacto de un menor, esa
garantía de integridad es tan relevante como la confidencialidad.

## Fuentes usadas en la validación

- Supabase RLS Best Practices — makerkit.dev
- Supabase Security Best Practices: RLS, API Keys & CVE-2025-48757 —
  vibeappscanner.com
- Row Level Security — supabase.com/docs
- Aviso de privacidad México 2026: LFPDPPP — legiscope.com
- Protección de datos personales en México: obligaciones LFPDPPP 2025 —
  aeabogados.com
