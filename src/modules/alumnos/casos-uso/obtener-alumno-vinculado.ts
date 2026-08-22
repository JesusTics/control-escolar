// Caso de uso: obtener el alumno vinculado al perfil actual (rol `alumno`),
// vía `alumnos.perfil_id` (columna agregada en
// supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql).
//
// Usado por el portal de alumno en `/dashboard` para resolver directamente
// SU propio expediente/kardex, sin pasar por el listado general de
// `/alumnos` (que para este rol, tras endurecer la RLS de SELECT en
// supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql,
// solo devolvería su propia fila — una lista de un elemento, confusa).
//
// Devuelve `alumno: null` (no un error) cuando el perfil todavía no está
// vinculado a ningún alumno — es un estado válido y esperado (ej. la
// invitación se creó sin seleccionar alumno), no una falla; el llamador
// decide cómo comunicarlo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alumno } from "../dominio/alumno";

export type ResultadoAlumnoVinculado =
  | { exito: true; alumno: Alumno | null }
  | { exito: false; error: string };

export async function obtenerAlumnoVinculado(
  supabase: SupabaseClient,
  perfilId: string,
): Promise<ResultadoAlumnoVinculado> {
  const { data, error } = await supabase
    .from("alumnos")
    .select("*")
    .eq("perfil_id", perfilId)
    .maybeSingle();

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, alumno: data as Alumno | null };
}
