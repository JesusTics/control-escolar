// Caso de uso: listar los alumnos del plantel del usuario actual que
// todavía NO tienen un perfil de Identidad/Roles vinculado
// (`alumnos.perfil_id is null`, columna agregada en
// supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql).
//
// Usado por la pantalla de invitaciones (`/plantel/invitaciones`) para
// ofrecer, al invitar a alguien con rol `alumno`, solo alumnos que
// realmente pueden vincularse — no tiene sentido mostrar (ni permitir
// seleccionar) un alumno que ya tiene cuenta.
//
// Mismo patrón que `listar-alumnos.ts`: sin lógica de negocio propia más
// allá del filtro, la RLS de `public.alumnos` ya acota el resultado al
// plantel del usuario actual.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alumno } from "../dominio/alumno";

export type ResultadoAlumnosSinVincular =
  | { exito: true; alumnos: Alumno[] }
  | { exito: false; error: string };

export async function listarAlumnosSinVincular(
  supabase: SupabaseClient,
): Promise<ResultadoAlumnosSinVincular> {
  const { data, error } = await supabase
    .from("alumnos")
    .select("*")
    .is("perfil_id", null)
    .order("nombre_completo", { ascending: true });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, alumnos: data as Alumno[] };
}
