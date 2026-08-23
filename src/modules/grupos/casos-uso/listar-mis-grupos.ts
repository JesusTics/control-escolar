// Caso de uso: listar los grupos que el docente actual tiene asignados (los
// que puede calificar/tomar asistencia). Usado por `/asistencia` para
// mostrarle a un docente solo sus grupos en el selector.
//
// A diferencia de `listar-materias.ts`/`listar-mis-materias-asignadas.ts`
// (donde la RLS ya acotaba el resultado por rol), la política
// `grupos_select_mismo_plantel` deja ver TODO el plantel a cualquier rol —
// aquí sí hace falta un filtro explícito de `docente_id` en la consulta,
// documentado a propósito para no repetir el error de asumir que RLS ya
// filtra.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrupoConNombres } from "../dominio/grupo";

export type ResultadoMisGrupos =
  | { exito: true; grupos: GrupoConNombres[] }
  | { exito: false; error: string };

interface FilaGrupoConNombres {
  id: string;
  plantel_id: string;
  materia_id: string;
  docente_id: string | null;
  nombre: string;
  periodo: string;
  created_at: string;
  materia: { nombre: string } | null;
  docente: { nombre_completo: string } | null;
}

export async function listarMisGrupos(
  supabase: SupabaseClient,
): Promise<ResultadoMisGrupos> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { exito: false, error: "Debes iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("grupos")
    .select(
      "id, plantel_id, materia_id, docente_id, nombre, periodo, created_at, materia:materias(nombre), docente:perfiles(nombre_completo)",
    )
    .eq("docente_id", user.id)
    .order("periodo", { ascending: false })
    .order("nombre", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  const grupos: GrupoConNombres[] = (
    data as unknown as FilaGrupoConNombres[]
  ).map((fila) => ({
    id: fila.id,
    plantel_id: fila.plantel_id,
    materia_id: fila.materia_id,
    docente_id: fila.docente_id,
    nombre: fila.nombre,
    periodo: fila.periodo,
    created_at: fila.created_at,
    materiaNombre: fila.materia?.nombre ?? "Materia desconocida",
    docenteNombre: fila.docente?.nombre_completo ?? null,
  }));

  return { exito: true, grupos };
}
