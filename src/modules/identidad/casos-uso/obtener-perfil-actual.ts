// Caso de uso: obtener el perfil (y plantel) del usuario autenticado actual.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PerfilConPlantel } from "../dominio/perfil";

export type ResultadoPerfilActual =
  | { exito: true; perfil: PerfilConPlantel | null }
  | { exito: false; error: string };

export async function obtenerPerfilActual(
  supabase: SupabaseClient,
): Promise<ResultadoPerfilActual> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { exito: true, perfil: null };
  }

  const { data, error } = await supabase
    .from("perfiles")
    .select("*, plantel:planteles(id, nombre)")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, perfil: data as PerfilConPlantel | null };
}
