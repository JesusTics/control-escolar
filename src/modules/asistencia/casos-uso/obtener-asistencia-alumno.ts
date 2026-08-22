// Caso de uso: obtener el historial de asistencia de un alumno y su
// porcentaje calculado, para mostrarlo en su kardex.
//
// Mismo patrón que `obtener-kardex-alumno.ts`: trae el alumno, sus registros
// (más recientes primero) y delega el cálculo del porcentaje al dominio puro
// (`calcularPorcentajeAsistencia`, sin red).
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularPorcentajeAsistencia } from "../dominio/asistencia";
import type { Asistencia } from "../dominio/asistencia";
import type { Alumno } from "@/modules/alumnos/dominio/alumno";

export interface AsistenciaAlumno {
  alumno: Alumno;
  registros: Asistencia[];
  porcentaje: number | null;
}

export type ResultadoAsistenciaAlumno =
  | { exito: true; asistencia: AsistenciaAlumno }
  | { exito: false; error: string };

export async function obtenerAsistenciaAlumno(
  supabase: SupabaseClient,
  alumnoId: string,
): Promise<ResultadoAsistenciaAlumno> {
  const { data: alumno, error: errorAlumno } = await supabase
    .from("alumnos")
    .select("*")
    .eq("id", alumnoId)
    .maybeSingle();

  if (errorAlumno) {
    return { exito: false, error: errorAlumno.message };
  }

  if (!alumno) {
    return { exito: false, error: "No se encontró el alumno." };
  }

  const { data: registros, error: errorRegistros } = await supabase
    .from("asistencias")
    .select("*")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: false });

  if (errorRegistros) {
    return { exito: false, error: errorRegistros.message };
  }

  const porcentaje = calcularPorcentajeAsistencia(
    registros as Asistencia[],
  );

  return {
    exito: true,
    asistencia: {
      alumno: alumno as Alumno,
      registros: registros as Asistencia[],
      porcentaje,
    },
  };
}
