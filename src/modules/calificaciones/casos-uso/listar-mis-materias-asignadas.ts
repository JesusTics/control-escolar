// Caso de uso: listar las materias que el docente actual tiene asignadas
// (las que puede calificar). Usado por
// `/alumnos/[id]/calificaciones/nueva` para filtrar el selector de materia
// según el rol — staff ve todas (`listar-materias.ts`), docente ve solo
// estas.
//
// Sin filtro explícito de `docente_id` en la consulta: la política RLS
// `docente_materias_select_propia_o_staff` ya acota el resultado a las
// propias para cualquier perfil que no sea staff (`docente_id = auth.uid()`)
// — mismo criterio que `listar-materias.ts` (confía en RLS, no duplica el
// filtro en la aplicación).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Materia } from "../dominio/calificacion";

export type ResultadoMisMateriasAsignadas =
  | { exito: true; materias: Materia[] }
  | { exito: false; error: string };

interface FilaAsignacionConMateria {
  materia: Materia | null;
}

export async function listarMisMateriasAsignadas(
  supabase: SupabaseClient,
): Promise<ResultadoMisMateriasAsignadas> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { exito: false, error: "Debes iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("docente_materias")
    .select("materia:materias(*)")
    .eq("docente_id", user.id);

  if (error) {
    return { exito: false, error: error.message };
  }

  const materias = (data as unknown as FilaAsignacionConMateria[])
    .map((fila) => fila.materia)
    .filter((materia): materia is Materia => materia !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { exito: true, materias };
}
