// Caso de uso: listar los perfiles con rol `docente` del plantel del usuario
// actual — usado por `/plantel/grupos` (y `/plantel/grupos/[id]`) para
// ofrecer el selector de docente al crear un grupo o cambiar su titular.
//
// Sin RLS nueva: la política `perfiles_select_mismo_plantel` (ver
// supabase/migrations/20260822213647_perfiles_visibles_mismo_plantel.sql) ya
// permite a cualquier usuario autenticado ver cualquier perfil de su mismo
// plantel — este caso de uso solo añade el filtro de rol, mismo criterio que
// `listar-alumnos-sin-vincular.ts` (filtro de aplicación sobre una tabla ya
// visible por RLS).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "../dominio/perfil";

export type ResultadoDocentesPlantel =
  | { exito: true; docentes: Perfil[] }
  | { exito: false; error: string };

export async function listarDocentesPlantel(
  supabase: SupabaseClient,
): Promise<ResultadoDocentesPlantel> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("rol", "docente")
    .order("nombre_completo", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, docentes: data as Perfil[] };
}
