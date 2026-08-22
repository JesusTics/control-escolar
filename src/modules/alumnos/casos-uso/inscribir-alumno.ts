// Caso de uso: inscribir un alumno nuevo en el plantel del usuario actual.
//
// Recibe el cliente de Supabase ya instanciado (inyectado desde el Server
// Action que lo llama) en vez de crearlo internamente, siguiendo el mismo
// patrón que `src/modules/identidad/` (ver ARCHITECTURE.md).
//
// Reglas de negocio validadas aquí (más allá del CRUD directo a Supabase):
// - `matricula` y `nombre_completo` no pueden estar vacíos.
// - La matrícula debe ser única dentro del plantel (`unique(plantel_id,
//   matricula)` en la tabla) — el error crudo de Postgres (código 23505) se
//   traduce a un mensaje de negocio claro en vez de dejarlo pasar tal cual.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alumno } from "../dominio/alumno";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosInscripcionAlumno {
  matricula: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
}

export type ResultadoInscripcionAlumno =
  | { exito: true; alumno: Alumno }
  | { exito: false; error: string };

const CODIGO_VIOLACION_UNIQUE = "23505";

export async function inscribirAlumno(
  supabase: SupabaseClient,
  datos: DatosInscripcionAlumno,
): Promise<ResultadoInscripcionAlumno> {
  const matricula = datos.matricula.trim();
  const nombreCompleto = datos.nombreCompleto.trim();

  if (!matricula || !nombreCompleto) {
    return { exito: false, error: "La matrícula y el nombre son obligatorios." };
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
    .from("alumnos")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      matricula,
      nombre_completo: nombreCompleto,
      fecha_nacimiento: datos.fechaNacimiento || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === CODIGO_VIOLACION_UNIQUE) {
      return {
        exito: false,
        error: "Ya existe un alumno con esa matrícula en este plantel.",
      };
    }

    // RLS rechaza el INSERT (sin error explícito de permisos) devolviendo
    // 0 filas afectadas más que un mensaje de "no autorizado" — Supabase lo
    // reporta como el código de Postgres para "no se aplicó la política".
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para inscribir alumnos.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, alumno: data as Alumno };
}
