// Caso de uso: cerrar la sesión activa.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoCerrarSesion =
  | { exito: true }
  | { exito: false; error: string };

export async function cerrarSesion(
  supabase: SupabaseClient,
): Promise<ResultadoCerrarSesion> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true };
}
