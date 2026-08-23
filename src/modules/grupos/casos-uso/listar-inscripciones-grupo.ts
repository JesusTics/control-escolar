// Caso de uso: listar los alumnos inscritos en un grupo específico, con su
// nombre/matrícula — usado por `/plantel/grupos/[id]` (staff, y el docente
// del grupo vía la política RLS `inscripciones_select_propia_o_staff_o_
// docente`) y por `registrar-asistencia-del-dia`/la pantalla de asistencia
// para poblar la lista de alumnos a capturar (SOLO los inscritos en el
// grupo elegido, no todo el plantel).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InscripcionConAlumno } from "../dominio/grupo";

export type ResultadoInscripcionesGrupo =
  | { exito: true; inscripciones: InscripcionConAlumno[] }
  | { exito: false; error: string };

interface FilaInscripcionConAlumno {
  id: string;
  plantel_id: string;
  alumno_id: string;
  grupo_id: string;
  created_at: string;
  alumno: { nombre_completo: string; matricula: string } | null;
}

export async function listarInscripcionesGrupo(
  supabase: SupabaseClient,
  grupoId: string,
): Promise<ResultadoInscripcionesGrupo> {
  const { data, error } = await supabase
    .from("inscripciones")
    .select(
      "id, plantel_id, alumno_id, grupo_id, created_at, alumno:alumnos(nombre_completo, matricula)",
    )
    .eq("grupo_id", grupoId)
    .order("created_at", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  const inscripciones: InscripcionConAlumno[] = (
    data as unknown as FilaInscripcionConAlumno[]
  ).map((fila) => ({
    id: fila.id,
    plantel_id: fila.plantel_id,
    alumno_id: fila.alumno_id,
    grupo_id: fila.grupo_id,
    created_at: fila.created_at,
    alumnoNombre: fila.alumno?.nombre_completo ?? "Alumno desconocido",
    alumnoMatricula: fila.alumno?.matricula ?? "—",
  }));

  return { exito: true, inscripciones };
}
