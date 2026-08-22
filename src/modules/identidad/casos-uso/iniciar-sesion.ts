// Caso de uso: iniciar sesión con email + contraseña.
//
// Recibe el cliente de Supabase ya instanciado (inyectado desde el Server
// Action / Server Component que lo llama) en vez de crearlo internamente,
// para quedar testeable sin mockear módulos.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CredencialesInicioSesion {
  email: string;
  password: string;
}

export type ResultadoInicioSesion =
  | { exito: true }
  | { exito: false; error: string };

export async function iniciarSesion(
  supabase: SupabaseClient,
  credenciales: CredencialesInicioSesion,
): Promise<ResultadoInicioSesion> {
  const { error } = await supabase.auth.signInWithPassword(credenciales);

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true };
}
