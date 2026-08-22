// Caso de uso: crear una materia nueva en el plantel del usuario actual.
//
// Recibe el cliente de Supabase ya instanciado (inyectado desde el Server
// Action que lo llama), siguiendo el mismo patrón que
// `src/modules/alumnos/casos-uso/inscribir-alumno.ts`.
//
// Reglas de negocio validadas aquí (más allá del CRUD directo a Supabase):
// - `nombre` no puede estar vacío.
// - El nombre debe ser único dentro del plantel (`unique(plantel_id,
//   nombre)` en la tabla) — el error crudo de Postgres (código 23505) se
//   traduce a un mensaje de negocio claro en vez de dejarlo pasar tal cual.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Materia } from "../dominio/calificacion";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosCrearMateria {
  nombre: string;
}

export type ResultadoCrearMateria =
  | { exito: true; materia: Materia }
  | { exito: false; error: string };

const CODIGO_VIOLACION_UNIQUE = "23505";

export async function crearMateria(
  supabase: SupabaseClient,
  datos: DatosCrearMateria,
): Promise<ResultadoCrearMateria> {
  const nombre = datos.nombre.trim();

  if (!nombre) {
    return { exito: false, error: "El nombre de la materia es obligatorio." };
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
    .from("materias")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      nombre,
    })
    .select()
    .single();

  if (error) {
    if (error.code === CODIGO_VIOLACION_UNIQUE) {
      return {
        exito: false,
        error: "Ya existe una materia con ese nombre en este plantel.",
      };
    }

    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para crear materias.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, materia: data as Materia };
}
