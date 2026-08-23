// Caso de uso: asignar una materia a un docente (staff) — cierra el hueco de
// mínimo privilegio "cualquier docente del plantel puede calificar cualquier
// materia" (ver supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql
// y 20260823000049_asignacion_docente_materia.sql).
//
// Recibe el cliente de Supabase ya instanciado, mismo patrón que el resto de
// casos de uso. `plantel_id` se resuelve desde la sesión actual (vía
// `obtener-perfil-actual`), nunca del formulario. El rol de staff requerido
// lo hace cumplir la política RLS `docente_materias_insert_staff`; aquí solo
// se traduce el 42501 y la violación de unicidad (`unique(docente_id,
// materia_id)`) a un mensaje de negocio claro, mismo criterio que
// `crear-invitacion.ts`/`crear-materia.ts`.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocenteMateria } from "../dominio/calificacion";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosAsignarDocenteMateria {
  docenteId: string;
  materiaId: string;
}

export type ResultadoAsignarDocenteMateria =
  | { exito: true; asignacion: DocenteMateria }
  | { exito: false; error: string };

const CODIGO_VIOLACION_UNIQUE = "23505";

export async function asignarDocenteMateria(
  supabase: SupabaseClient,
  datos: DatosAsignarDocenteMateria,
): Promise<ResultadoAsignarDocenteMateria> {
  if (!datos.docenteId || !datos.materiaId) {
    return { exito: false, error: "Selecciona un docente y una materia." };
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
    .from("docente_materias")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      docente_id: datos.docenteId,
      materia_id: datos.materiaId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === CODIGO_VIOLACION_UNIQUE) {
      return {
        exito: false,
        error: "Ese docente ya tiene asignada esta materia.",
      };
    }

    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para asignar materias a docentes.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, asignacion: data as DocenteMateria };
}
