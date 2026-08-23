// Caso de uso: crear un grupo nuevo (staff) — una instancia concreta de una
// materia impartida en un periodo, con un docente opcionalmente asignado
// desde el alta (también se puede asignar/cambiar después, ver
// `asignar-docente-grupo.ts`).
//
// Recibe el cliente de Supabase ya instanciado, mismo patrón que el resto de
// casos de uso. `plantel_id` se resuelve desde la sesión actual (vía
// `obtener-perfil-actual`), nunca del formulario. El rol de staff requerido
// lo hace cumplir la política RLS `grupos_insert_staff`; aquí solo se
// traduce el 42501 y la violación de `unique(materia_id, nombre, periodo)` a
// un mensaje de negocio claro, mismo criterio que `crear-materia.ts`.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Grupo } from "../dominio/grupo";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosCrearGrupo {
  materiaId: string;
  nombre: string;
  periodo: string;
  docenteId?: string;
}

export type ResultadoCrearGrupo =
  | { exito: true; grupo: Grupo }
  | { exito: false; error: string };

const CODIGO_VIOLACION_UNIQUE = "23505";

export async function crearGrupo(
  supabase: SupabaseClient,
  datos: DatosCrearGrupo,
): Promise<ResultadoCrearGrupo> {
  const nombre = datos.nombre.trim();
  const periodo = datos.periodo.trim();

  if (!datos.materiaId || !nombre || !periodo) {
    return {
      exito: false,
      error: "Materia, nombre del grupo y periodo son obligatorios.",
    };
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
    .from("grupos")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      materia_id: datos.materiaId,
      nombre,
      periodo,
      docente_id: datos.docenteId || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === CODIGO_VIOLACION_UNIQUE) {
      return {
        exito: false,
        error: "Ya existe un grupo con ese nombre para esa materia y periodo.",
      };
    }

    if (error.code === "42501") {
      return { exito: false, error: "No tienes permiso para crear grupos." };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, grupo: data as Grupo };
}
