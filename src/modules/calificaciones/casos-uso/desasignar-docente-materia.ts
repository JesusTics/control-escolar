// Caso de uso: desasignar (quitar) una materia asignada a un docente
// (staff). A diferencia de calificaciones/asistencias (donde re-registrar
// ES la forma de corregir, sin DELETE), aquí sí tiene sentido un DELETE
// real: una asignación es un vínculo binario vigente/no vigente, sin
// historial que preservar.
//
// El rol de staff requerido lo hace cumplir la política RLS
// `docente_materias_delete_staff` — si un usuario sin ese rol invoca este
// caso de uso, RLS filtra la fila objetivo (no hay error, cero filas
// afectadas), así que se verifica explícitamente `count` para dar un mensaje
// de negocio claro en vez de un "éxito" silencioso engañoso.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoDesasignarDocenteMateria =
  | { exito: true }
  | { exito: false; error: string };

export async function desasignarDocenteMateria(
  supabase: SupabaseClient,
  asignacionId: string,
): Promise<ResultadoDesasignarDocenteMateria> {
  if (!asignacionId) {
    return { exito: false, error: "Falta el identificador de la asignación." };
  }

  const { error, count } = await supabase
    .from("docente_materias")
    .delete({ count: "exact" })
    .eq("id", asignacionId);

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para desasignar materias a docentes.",
      };
    }

    return { exito: false, error: error.message };
  }

  if (!count) {
    return {
      exito: false,
      error: "No tienes permiso para desasignar materias a docentes.",
    };
  }

  return { exito: true };
}
