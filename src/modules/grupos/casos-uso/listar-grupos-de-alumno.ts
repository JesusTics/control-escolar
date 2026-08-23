// Caso de uso: listar los grupos en los que está inscrito un alumno
// específico, con el nombre de materia/grupo/periodo — usado por
// `/alumnos/[id]/calificaciones/nueva` para el selector de "grupo" al
// registrar una calificación.
//
// Decisión de diseño importante: NO se filtra aquí por docente en la
// aplicación. La política RLS `inscripciones_select_propia_o_staff_o_
// docente` ya acota qué inscripciones puede ver cada rol — cuando este caso
// de uso lo invoca un perfil `docente`, RLS solo deja ver las inscripciones
// de grupos donde ese docente es `grupos.docente_id`, así que el resultado
// YA ES la intersección "grupos del alumno ∩ grupos del docente" pedida por
// la tarea, sin duplicar esa lógica aquí. Staff ve todos los grupos del
// alumno sin restricción (RLS lo permite).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrupoDeAlumno } from "../dominio/grupo";

export type ResultadoGruposDeAlumno =
  | { exito: true; grupos: GrupoDeAlumno[] }
  | { exito: false; error: string };

interface FilaInscripcionConGrupo {
  id: string;
  grupo_id: string;
  grupo: {
    nombre: string;
    periodo: string;
    materia: { nombre: string } | null;
  } | null;
}

export async function listarGruposDeAlumno(
  supabase: SupabaseClient,
  alumnoId: string,
): Promise<ResultadoGruposDeAlumno> {
  const { data, error } = await supabase
    .from("inscripciones")
    .select(
      "id, grupo_id, grupo:grupos(nombre, periodo, materia:materias(nombre))",
    )
    .eq("alumno_id", alumnoId);

  if (error) {
    return { exito: false, error: error.message };
  }

  const grupos: GrupoDeAlumno[] = (
    data as unknown as FilaInscripcionConGrupo[]
  )
    .filter((fila) => fila.grupo !== null)
    .map((fila) => ({
      inscripcionId: fila.id,
      grupoId: fila.grupo_id,
      grupoNombre: fila.grupo!.nombre,
      periodo: fila.grupo!.periodo,
      materiaNombre: fila.grupo!.materia?.nombre ?? "Materia desconocida",
    }));

  return { exito: true, grupos };
}
