// Caso de uso: listar los alumnos del plantel del usuario actual.
//
// Sin lógica de negocio propia más allá de la consulta — la RLS de
// `public.alumnos` (política `alumnos_select_mismo_plantel`) ya filtra por
// plantel, pero igual se recibe el cliente inyectado siguiendo el mismo
// patrón que el resto de casos de uso del proyecto.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alumno } from "../dominio/alumno";

export type ResultadoListaAlumnos =
  | { exito: true; alumnos: Alumno[] }
  | { exito: false; error: string };

export async function listarAlumnos(
  supabase: SupabaseClient,
): Promise<ResultadoListaAlumnos> {
  const { data, error } = await supabase
    .from("alumnos")
    .select("*")
    .order("nombre_completo", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, alumnos: data as Alumno[] };
}
