// Caso de uso: registrar (o corregir) la asistencia de todos los alumnos
// capturados en un día determinado, en una sola operación.
//
// Recibe el cliente de Supabase ya instanciado, siguiendo el mismo patrón
// que el resto de casos de uso del proyecto.
//
// Reglas de negocio validadas aquí:
// - `fecha` y al menos un registro son obligatorios.
// - Se usa `.upsert()` masivo con `onConflict: 'alumno_id,fecha'` en vez de
//   `.insert()`: volver a capturar la asistencia del mismo día para el mismo
//   alumno corrige el registro existente en vez de fallar por violación de
//   unicidad — mismo criterio que `registrar-calificacion.ts`, y es lo que
//   habilita corregir la lista sin duplicar filas si alguien se equivoca.
// - Una sola llamada con el arreglo completo, no una petición por alumno —
//   CLAUDE.md 7 pide explícitamente "modo asistido/wizard para... captura
//   masiva".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asistencia, EstadoAsistencia } from "../dominio/asistencia";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface RegistroAsistenciaAlumno {
  alumnoId: string;
  estado: EstadoAsistencia;
}

export interface DatosRegistrarAsistenciaDelDia {
  fecha: string;
  registros: RegistroAsistenciaAlumno[];
}

export type ResultadoRegistrarAsistenciaDelDia =
  | { exito: true; asistencias: Asistencia[] }
  | { exito: false; error: string };

export async function registrarAsistenciaDelDia(
  supabase: SupabaseClient,
  datos: DatosRegistrarAsistenciaDelDia,
): Promise<ResultadoRegistrarAsistenciaDelDia> {
  const fecha = datos.fecha.trim();

  if (!fecha) {
    return { exito: false, error: "La fecha es obligatoria." };
  }

  if (datos.registros.length === 0) {
    return {
      exito: false,
      error: "No hay alumnos para registrar asistencia.",
    };
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

  const filas = datos.registros.map((registro) => ({
    plantel_id: resultadoPerfil.perfil!.plantel_id,
    alumno_id: registro.alumnoId,
    fecha,
    estado: registro.estado,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("asistencias")
    .upsert(filas, { onConflict: "alumno_id,fecha" })
    .select();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para registrar asistencia.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, asistencias: data as Asistencia[] };
}
