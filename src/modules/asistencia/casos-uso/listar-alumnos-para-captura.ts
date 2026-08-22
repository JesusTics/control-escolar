// Caso de uso: listar los alumnos activos del plantel para la pantalla de
// captura masiva de asistencia (`/asistencia`).
//
// A diferencia de `listar-alumnos` (módulo Alumnos, que lista todos los
// alumnos sin importar estado, para el directorio general), aquí se filtra
// explícitamente por `estado = 'activo'` — no tiene sentido tomar asistencia
// de un alumno dado de baja. No se reutiliza `listar-alumnos` sin
// modificarlo porque el filtro es una regla propia de este caso de uso, no
// del listado general.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alumno } from "@/modules/alumnos/dominio/alumno";

export type ResultadoAlumnosParaCaptura =
  | { exito: true; alumnos: Alumno[] }
  | { exito: false; error: string };

export async function listarAlumnosParaCaptura(
  supabase: SupabaseClient,
): Promise<ResultadoAlumnosParaCaptura> {
  const { data, error } = await supabase
    .from("alumnos")
    .select("*")
    .eq("estado", "activo")
    .order("nombre_completo", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, alumnos: data as Alumno[] };
}
