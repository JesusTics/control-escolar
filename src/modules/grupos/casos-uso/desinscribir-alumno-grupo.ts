// Caso de uso: desinscribir (quitar) a un alumno de un grupo (staff). Mismo
// criterio que `desasignar-docente-materia.ts` (sesión anterior, ya
// retirado): un DELETE real, sin historial que preservar, verificando
// explícitamente `count` porque RLS filtra la fila objetivo en vez de
// devolver un error cuando el usuario no tiene permiso.
//
// Nota de integridad: si el alumno ya tiene calificaciones/asistencia
// registradas en este grupo, la FK `calificaciones.grupo_id`/`asistencias.
// grupo_id` -> `grupos.id` sigue intacta (desinscribir no borra grupos ni
// calificaciones) — el alumno deja de aparecer como inscrito pero su
// historial en ese grupo no se pierde.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoDesinscribirAlumnoGrupo =
  | { exito: true }
  | { exito: false; error: string };

export async function desinscribirAlumnoGrupo(
  supabase: SupabaseClient,
  inscripcionId: string,
): Promise<ResultadoDesinscribirAlumnoGrupo> {
  if (!inscripcionId) {
    return { exito: false, error: "Falta el identificador de la inscripción." };
  }

  const { error, count } = await supabase
    .from("inscripciones")
    .delete({ count: "exact" })
    .eq("id", inscripcionId);

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para desinscribir alumnos de grupos.",
      };
    }

    return { exito: false, error: error.message };
  }

  if (!count) {
    return {
      exito: false,
      error: "No tienes permiso para desinscribir alumnos de grupos.",
    };
  }

  return { exito: true };
}
