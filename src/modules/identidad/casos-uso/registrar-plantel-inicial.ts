// Caso de uso: alta del primer plantel + perfil de un usuario recién
// registrado (`auth.signUp` ya debe haberse ejecutado y haber una sesión
// activa antes de llamar a este caso de uso).
//
// Delega la creación en la función Postgres `security definer`
// `crear_plantel_y_perfil_inicial` (ver
// `supabase/migrations/20260822075713_alta_inicial_identidad.sql`) en vez de
// hacer los INSERTs directamente desde aquí: las políticas RLS de
// `perfiles`/`planteles` no permiten esta alta con el rol `authenticated`
// normal, y la alternativa (política de INSERT abierta, o `service_role` en
// el código de la app) está explícitamente prohibida por CLAUDE.md 4.3.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "../dominio/perfil";

export interface DatosRegistroInicial {
  nombrePlantel: string;
  nombreCompleto: string;
}

export type ResultadoRegistroInicial =
  | { exito: true; perfil: Perfil }
  | { exito: false; error: string };

export async function registrarPlantelInicial(
  supabase: SupabaseClient,
  datos: DatosRegistroInicial,
): Promise<ResultadoRegistroInicial> {
  const { data, error } = await supabase.rpc(
    "crear_plantel_y_perfil_inicial",
    {
      p_nombre_plantel: datos.nombrePlantel,
      p_nombre_completo: datos.nombreCompleto,
    },
  );

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, perfil: data as Perfil };
}
