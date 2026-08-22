// Caso de uso: listar las materias del plantel del usuario actual.
//
// Sin lógica de negocio propia más allá de la consulta — la RLS de
// `public.materias` (política `materias_select_mismo_plantel`) ya filtra por
// plantel, pero igual se recibe el cliente inyectado siguiendo el mismo
// patrón que el resto de casos de uso del proyecto.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Materia } from "../dominio/calificacion";

export type ResultadoListaMaterias =
  | { exito: true; materias: Materia[] }
  | { exito: false; error: string };

export async function listarMaterias(
  supabase: SupabaseClient,
): Promise<ResultadoListaMaterias> {
  const { data, error } = await supabase
    .from("materias")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, materias: data as Materia[] };
}
