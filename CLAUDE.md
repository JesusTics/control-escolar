# Plataforma de Control Escolar — Reglas del Proyecto

> Este documento es la fuente de verdad de arquitectura, principios y metodología.
> Cualquier decisión que lo contradiga debe justificarse por escrito en /docs/adr/.

## 1. Visión del producto

Plataforma de control escolar tipo AMBAR (TecNM), pensada desde el inicio para
**redes de planteles** (multi-institución, multi-tenant), con dos diferenciadores
centrales frente a la competencia (AMBAR, DVcore, Servoescolar, Controlisis,
EsCoolKardex):

1. **UX radicalmente simple**, diseñada para usuarios no técnicos y de mayor edad
   (docentes/administrativos), no solo para "power users".
2. **IA integrada de forma invisible y útil** (RAG institucional, automatización
   de captura, alertas predictivas), no como feature decorativa.

## 2. Cliente objetivo (MVP)

Redes de varios planteles bajo una organización matriz — como el modelo TecNM/AMBAR.
La arquitectura se diseña multi-tenant desde el día 1, aunque el primer cliente
real tenga un solo plantel.

## 3. Alcance del MVP — Oleada 1

Solo estos módulos, formando un ciclo completo de valor:

- Gestión de alumnos y expedientes
- Calificaciones y kardex
- Asistencia
- Comunicación (avisos a padres/alumnos/docentes)
- Portales por rol: alumno / docente / administrativo / oficina central

**Explícitamente fuera del MVP** (Oleada 2+): cobranza/CFDI, RH/nómina,
vinculación/servicio social, evaluación docente, API pública institucional.

## 4. Principios de arquitectura (no negociables)

### 4.1 Arquitectura hexagonal (Ports & Adapters) + DDD ligero — aplicación selectiva

Hexagonal completo desde el día 1 en todos los módulos es sobreingeniería
para un equipo de una persona asistida por IA construyendo un MVP (ver
[ADR-0001](docs/adr/0001-validacion-arquitectura-inicial.md)). Se aplica
**solo** donde hay una de estas dos condiciones:

- Lógica de negocio no trivial (reglas, cálculos, invariantes) — ej.
  Calificaciones (promedios, reprobación), Asistencia, Identidad/Roles.
- Integración con un proveedor externo real (email, pagos, IA) donde cambiar
  de proveedor es plausible.

Ahí, la lógica de negocio se aísla del framework web (Next.js), del proveedor
de base de datos (Supabase/Postgres) y de proveedores externos, accediendo a
ellos solo vía interfaces (`IEmailSender`, `IPaymentGateway`,
`IStudentRepository`, etc.).

Para CRUD simple sin reglas de negocio (expedientes, catálogos, datos de
solo lectura) se accede directo a Supabase desde el caso de uso, sin capa de
puertos artificial — una interfaz con una sola implementación real no es
arquitectura, es ceremonia.

Bounded contexts sugeridos (uno por módulo): `Alumnos`, `Calificaciones`,
`Asistencia`, `Comunicacion`, `Identidad/Roles`. Cada oleada futura se agrega
preferentemente como un nuevo bounded context, pero **sí se modifica** un
bounded context existente cuando el dominio lo exige (ver 4.2).

### 4.2 SOLID aplicado, no dogmático

- **S**: un caso de uso = una responsabilidad (`InscribirAlumno`,
  `RegistrarCalificacion`, `MarcarAsistencia`). Nada de controladores gigantes.
- **O/L**: nuevas oleadas se agregan preferentemente como nuevos casos de uso.
  Modificar código existente está permitido y se espera cuando el dominio lo
  exige (ej. cobranza en Oleada 2 necesita que Alumnos exponga estado de
  adeudo) — la regla no es "cero modificaciones", es "cambios controlados y
  cubiertos por tests de regresión" (ver 5, TDD-lite + CI).
- **I**: interfaces pequeñas y específicas por responsabilidad, no
  "mega-repositorios" o "mega-servicios".
- **D**: la lógica de negocio depende de abstracciones, nunca de
  implementaciones concretas de infraestructura.

### 4.3 Multi-tenancy (regla crítica de seguridad)

- Toda tabla con datos de una institución incluye `plantel_id`.
- Aislamiento reforzado con **Row-Level Security** en Postgres — no confiar
  solo en filtros a nivel de aplicación.
- El aislamiento multi-tenant se cubre con tests automáticos obligatorios
  **desde el primer commit que toque una tabla nueva**, no como deuda técnica
  para después — antes de cualquier release. Es la única superficie donde un
  bug compromete datos de una institución completa, y es el riesgo #1 del
  proyecto (ver [ADR-0001](docs/adr/0001-validacion-arquitectura-inicial.md)).
- **RLS se habilita explícitamente en cada tabla nueva** — en Supabase está
  desactivada por default, y una tabla sin RLS es de acceso público. CI debe
  fallar el build si detecta una tabla sin RLS habilitada.
- **`service_role` (Supabase) nunca se usa en el flujo normal de request de
  usuario** — bypassea RLS por completo. Se reserva para jobs administrativos
  muy acotados y documentados explícitamente como excepción.
- Los tests de aislamiento multi-tenant corren **contra el SDK cliente**
  (como lo vería un usuario real), nunca contra el SQL Editor de Supabase u
  otra vía que bypasee RLS — de lo contrario dan falsa confianza.
- Las columnas usadas en políticas RLS (`plantel_id`, `usuario_id`) se
  indexan explícitamente — es la causa más común de degradación de
  performance con RLS.

### 4.4 Cumplimiento y privacidad (LFPDPPP)

Se manejan datos de menores de edad y datos personales sensibles (médicos,
tutores, contacto). Esto se diseña desde el inicio, no se agrega después:
- Minimización de datos por defecto.
- Control de acceso por rol estricto.
- Bitácora de accesos a datos sensibles.
- **Aviso de privacidad formal** (identidad del responsable, finalidades,
  mecanismo de derechos ARCO) antes de capturar cualquier dato personal —
  requisito legal directo de la LFPDPPP, no opcional.
- **Derechos ARCO operables como caso de uso real** (acceso, rectificación,
  cancelación, oposición), no solo mencionados en el aviso de privacidad.
- **Cifrado en reposo** para campos sensibles (datos médicos, contacto de
  tutores) más allá de lo que da por default la infraestructura.
- **Interés superior del menor** como principio explícito en el tratamiento
  de datos de estudiantes — obligación legal directa al manejar datos de
  menores en México, no solo buena práctica.

Nota de residencia de datos: la LFPDPPP no exige que los datos vivan
físicamente en México, siempre que exista un contrato de transferencia
internacional adecuado (cubierto por el DPA de Supabase/Vercel). El riesgo
real no es legal sino de percepción comercial con instituciones
conservadoras — ver [ADR-0001](docs/adr/0001-validacion-arquitectura-inicial.md).

## 5. Metodología de desarrollo

- **Trunk-based development**, ramas cortas por feature, aunque el equipo sea
  de una sola persona (con asistencia de IA). Incrementos pequeños y revisables.
- **TDD-lite en lógica crítica**: kardex, cálculo de calificaciones,
  permisos y aislamiento multi-tenant llevan tests automáticos obligatorios.
  UI y detalles visuales no requieren el mismo rigor.
- **CI/CD desde el primer commit** (GitHub Actions): build + tests en cada PR.
  Es la red de seguridad ante la ausencia de revisión humana de un equipo.
- **ADRs (Architecture Decision Records)** en `/docs/adr/`: cada decisión
  técnica relevante se documenta en formato corto (contexto, decisión,
  consecuencias). Necesario para no perder el "por qué" al trabajar con
  asistencia de IA a lo largo del tiempo.

## 6. Stack de infraestructura

| Capa | Elección | Razón |
|---|---|---|
| Full-stack | Next.js + TypeScript | Un repo, un lenguaje, buen soporte de tooling de IA |
| Base de datos | PostgreSQL + Row-Level Security | Aislamiento multi-tenant a nivel de motor |
| Backend gestionado | Supabase | Auth + DB + Storage sin infraestructura propia |
| RAG | pgvector (dentro de Postgres) | Sin sumar una vector DB aparte mientras el equipo es pequeño |
| Hosting / CI | Vercel + GitHub Actions | Despliegues automáticos, previews por PR, bajo mantenimiento |
| IA | API de Claude | RAG institucional, generación de reportes, alertas predictivas |

Explícitamente evitado por ahora: microservicios, Docker multi-servicio,
infraestructura propia — complejidad que se justifica solo con equipo y
escala mayores (etapa AMBAR-actual, no MVP).

**Región**: se fija explícitamente `sa-east-1` (Supabase) / `gru1` (Vercel,
São Paulo) en vez de la región default en EE.UU. — es lo más cercano a
México disponible en ambos proveedores hoy. Si un cliente institucional
grande exige residencia física de datos en México, la opción real es AWS
`mx-central-1` (Querétaro, disponible desde ene-2025), evaluada como
alternativa de Oleada 2+, no del MVP — ver
[ADR-0001](docs/adr/0001-validacion-arquitectura-inicial.md).

**Costo estimado**: MVP/piloto (1 plantel, 500-2000 alumnos) ≈ $45-55
USD/mes (Supabase Pro + Vercel Pro). Red mediana (~10 planteles, ~20k
alumnos) ≈ $400-900 USD/mes. Vigilar especialmente: egress de Supabase
(tras 250GB incluidos) y PITR ($100/mes por ventana de 7 días, fácil de
activar tarde y pagar retroactivo tras un incidente) — configurar alertas
de uso desde el día 1.

## 7. Principios de UX (diferenciador central del producto)

- Una acción por pantalla, flujo lineal — nunca menús con muchas opciones simultáneas.
- Botones grandes, texto explícito sobre íconos ambiguos.
- Deshacer siempre disponible, en vez de diálogos de confirmación bloqueantes.
- Autoguardado — nunca perder trabajo por no presionar "Guardar".
- Modo asistido/wizard para tareas complejas (cierre de periodo, captura masiva).
- Capacitación integrada en el producto (tooltips, video corto embebido),
  no manuales PDF externos.

## 8. Roadmap de oleadas

1. **Oleada 1 (MVP)**: alumnos, kardex/calificaciones, asistencia,
   comunicación, portales por rol.
2. **Oleada 2**: cobranza/pagos en línea, horarios/carga académica,
   tickets de soporte interno.
3. **Oleada 3**: RH, vinculación/servicio social, evaluación docente,
   API pública institucional.

## 9. Casos de uso de IA (por prioridad)

1. RAG institucional para docentes/administrativos (consulta de reglamentos
   y manuales propios de la institución).
2. Automatización de captura (OCR de documentos de inscripción, actas).
3. Alertas predictivas de riesgo de deserción/reprobación (asistencia +
   calificaciones).
4. Generación asistida de reportes y oficios a partir de datos estructurados.

Regla de diseño: la IA debe sentirse invisible y útil dentro del flujo de
trabajo, nunca como una feature aparte que hay que aprender a usar.