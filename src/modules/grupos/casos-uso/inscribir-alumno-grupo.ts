// Caso de uso: inscribir un alumno a un grupo (staff).
//
// Recibe el cliente de Supabase ya instanciado, mismo patrón que el resto de
// casos de uso. `plantel_id` se resuelve desde la sesión actual, nunca del
// formulario. El rol de staff requerido lo hace cumplir la política RLS
// `inscripciones_insert_staff`; aquí se traduce el 42501 y la violación de
// `unique(alumno_id, grupo_id)` a un mensaje de negocio claro, mismo
// criterio que `asignar-docente-materia.ts` (sesión anterior, ya retirado).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Inscripcion } from "../dominio/grupo";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosInscribirAlumnoGrupo {
  alumnoId: string;
  grupoId: string;
}

export type ResultadoInscribirAlumnoGrupo =
  | { exito: true; inscripcion: Inscripcion }
  | { exito: false; error: string };

const CODIGO_VIOLACION_UNIQUE = "23505";

export async function inscribirAlumnoGrupo(
  supabase: SupabaseClient,
  datos: DatosInscribirAlumnoGrupo,
): Promise<ResultadoInscribirAlumnoGrupo> {
  if (!datos.alumnoId || !datos.grupoId) {
    return { exito: false, error: "Selecciona un alumno y un grupo." };
  }

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    return { exito: false, error: resultadoPerfil.error };
  }

  if (!resultadoPerfil.perfil) {
    return {
      exito: false,
      error: "Tu cuenta todavía no tiene un plantel asociado.",
    };
  }

  const { data, error } = await supabase
    .from("inscripciones")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      alumno_id: datos.alumnoId,
      grupo_id: datos.grupoId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === CODIGO_VIOLACION_UNIQUE) {
      return {
        exito: false,
        error: "Este alumno ya está inscrito en este grupo.",
      };
    }

    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para inscribir alumnos a grupos.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, inscripcion: data as Inscripcion };
}
