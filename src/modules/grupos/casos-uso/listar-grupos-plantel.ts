// Caso de uso: listar TODOS los grupos del plantel del usuario actual, con
// el nombre de la materia y del docente asignado (si tiene) — usado por
// staff en `/plantel/grupos` para gestionarlos.
//
// La política RLS `grupos_select_mismo_plantel` no filtra por rol (cualquier
// usuario autenticado del plantel ve todos los grupos) — es lo que permite
// que, por ejemplo, un alumno pueda eventualmente ver el catálogo de grupos
// de su plantel sin depender de estar inscrito. `listar-mis-grupos.ts`
// filtra explícitamente por docente para el caso complementario.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrupoConNombres } from "../dominio/grupo";

export type ResultadoGruposPlantel =
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

export async function listarGruposPlantel(
  supabase: SupabaseClient,
): Promise<ResultadoGruposPlantel> {
  const { data, error } = await supabase
    .from("grupos")
    .select(
      "id, plantel_id, materia_id, docente_id, nombre, periodo, created_at, materia:materias(nombre), docente:perfiles(nombre_completo)",
    )
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
