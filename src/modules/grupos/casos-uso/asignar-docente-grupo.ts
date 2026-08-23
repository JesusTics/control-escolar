// Caso de uso: asignar o cambiar el docente de un grupo existente (staff).
//
// El rol de staff requerido lo hace cumplir la política RLS
// `grupos_update_staff`; aquí solo se traduce el 42501 a un mensaje de
// negocio claro, mismo criterio que el resto del proyecto. Acepta
// `docenteId` vacío/`undefined` para poder DEJAR el grupo sin docente
// asignado (equivalente a "quitar" sin un caso de uso separado).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Grupo } from "../dominio/grupo";

export interface DatosAsignarDocenteGrupo {
  grupoId: string;
  docenteId: string | null;
}

export type ResultadoAsignarDocenteGrupo =
  | { exito: true; grupo: Grupo }
  | { exito: false; error: string };

export async function asignarDocenteGrupo(
  supabase: SupabaseClient,
  datos: DatosAsignarDocenteGrupo,
): Promise<ResultadoAsignarDocenteGrupo> {
  if (!datos.grupoId) {
    return { exito: false, error: "Falta el identificador del grupo." };
  }

  const { data, error } = await supabase
    .from("grupos")
    .update({ docente_id: datos.docenteId || null })
    .eq("id", datos.grupoId)
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para asignar el docente de este grupo.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, grupo: data as Grupo };
}
