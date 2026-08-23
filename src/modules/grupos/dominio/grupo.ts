// Tipos de dominio del bounded context Grupos (Oleada 2, "horarios/carga
// académica" acotado a su mínimo — ver
// supabase/migrations/20260823003328_grupos_e_inscripciones.sql).
//
// Un "grupo" es una instancia concreta de una materia impartida por un
// docente en un periodo (ej. "Matemáticas — Grupo A"), estilo universidad:
// un alumno se inscribe individualmente a varios grupos (`inscripciones`),
// no un solo grupo fijo tipo primaria. Reemplaza el propósito de
// `docente_materias` (retirada en
// supabase/migrations/20260823003340_retirar_docente_materias.sql): la
// asignación docente<->calificación ahora se resuelve vía `grupos.
// docente_id`, no una asignación general a la materia.
//
// Se aplica hexagonal ligero aquí (CLAUDE.md 4.1): hay lógica de negocio no
// trivial (integridad inscripción<->calificación/asistencia).

export interface Grupo {
  id: string;
  plantel_id: string;
  materia_id: string;
  docente_id: string | null;
  nombre: string;
  periodo: string;
  created_at: string;
}

// Fila enriquecida con el nombre de materia/docente, usada en las pantallas
// de gestión (`/plantel/grupos`) — mismo criterio que
// `AsignacionDocenteMateria` (módulo Calificaciones, hasta antes de esta
// sesión) y `SolicitudArcoConSolicitante` (Identidad/Roles).
export interface GrupoConNombres extends Grupo {
  materiaNombre: string;
  docenteNombre: string | null;
}

export interface Inscripcion {
  id: string;
  plantel_id: string;
  alumno_id: string;
  grupo_id: string;
  created_at: string;
}

// Fila enriquecida con los datos del alumno inscrito, usada en
// `/plantel/grupos/[id]` para la lista de inscritos.
export interface InscripcionConAlumno extends Inscripcion {
  alumnoNombre: string;
  alumnoMatricula: string;
}

// Grupo en el que está inscrito un alumno específico, con los datos
// necesarios para el selector de `/alumnos/[id]/calificaciones/nueva` y la
// pantalla de asistencia — usado por `listar-grupos-de-alumno.ts`.
export interface GrupoDeAlumno {
  inscripcionId: string;
  grupoId: string;
  grupoNombre: string;
  periodo: string;
  materiaNombre: string;
}
