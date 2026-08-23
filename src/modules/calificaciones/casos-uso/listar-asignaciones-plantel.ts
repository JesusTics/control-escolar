// Caso de uso: listar TODAS las asignaciones docente<->materia del plantel
// del usuario actual, con el nombre del docente y de la materia — usado por
// el staff (administrativo/oficina_central) en `/plantel/asignaciones` para
// gestionarlas.
//
// La política RLS `docente_materias_select_propia_o_staff` ya exige rol de
// staff para ver asignaciones ajenas — un docente que invoque este caso de
// uso solo recibiría las suyas (ver `listar-mis-materias-asignadas.ts` para
// ese caso), no un error, mismo comportamiento que el resto de módulos con
// RLS de staff (ver `listar-invitaciones.ts`, `listar-solicitudes-arco-
// plantel.ts`).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsignacionDocenteMateria } from "../dominio/calificacion";

export type ResultadoAsignacionesPlantel =
  | { exito: true; asignaciones: AsignacionDocenteMateria[] }
  | { exito: false; error: string };

interface FilaAsignacionConNombres {
  id: string;
  plantel_id: string;
  docente_id: string;
  materia_id: string;
  created_at: string;
  docente: { nombre_completo: string } | null;
  materia: { nombre: string } | null;
}

export async function listarAsignacionesPlantel(
  supabase: SupabaseClient,
): Promise<ResultadoAsignacionesPlantel> {
  const { data, error } = await supabase
    .from("docente_materias")
    .select(
      "id, plantel_id, docente_id, materia_id, created_at, docente:perfiles(nombre_completo), materia:materias(nombre)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { exito: false, error: error.message };
  }

  const asignaciones: AsignacionDocenteMateria[] = (
    data as unknown as FilaAsignacionConNombres[]
  ).map((fila) => ({
    id: fila.id,
    plantel_id: fila.plantel_id,
    docente_id: fila.docente_id,
    materia_id: fila.materia_id,
    created_at: fila.created_at,
    docenteNombre: fila.docente?.nombre_completo ?? "Docente desconocido",
    materiaNombre: fila.materia?.nombre ?? "Materia desconocida",
  }));

  return { exito: true, asignaciones };
}
