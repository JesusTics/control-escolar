// Caso de uso: obtener el kardex (calificaciones) de un alumno, con el
// nombre de cada materia, el promedio general y si el alumno está aprobado
// en cada una.
//
// Sin promedio por materia (una sola calificación por materia/periodo,
// ver alcance de la tarea) — "aprobado" se calcula directo sobre esa
// calificación individual con `estaAprobado` (dominio puro, sin red).
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularPromedio, estaAprobado } from "../dominio/calificacion";
import type { Alumno } from "@/modules/alumnos/dominio/alumno";

export interface CalificacionKardex {
  id: string;
  materiaId: string;
  materiaNombre: string;
  periodo: string;
  calificacion: number;
  aprobado: boolean;
}

export interface Kardex {
  alumno: Alumno;
  calificaciones: CalificacionKardex[];
  promedioGeneral: number | null;
}

export type ResultadoKardexAlumno =
  | { exito: true; kardex: Kardex }
  | { exito: false; error: string };

interface FilaCalificacionConMateria {
  id: string;
  materia_id: string;
  periodo: string;
  calificacion: number;
  materia: { nombre: string } | null;
}

export async function obtenerKardexAlumno(
  supabase: SupabaseClient,
  alumnoId: string,
): Promise<ResultadoKardexAlumno> {
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

  const { data: filas, error: errorCalificaciones } = await supabase
    .from("calificaciones")
    .select("id, materia_id, periodo, calificacion, materia:materias(nombre)")
    .eq("alumno_id", alumnoId)
    .order("periodo", { ascending: false });

  if (errorCalificaciones) {
    return { exito: false, error: errorCalificaciones.message };
  }

  const calificaciones: CalificacionKardex[] = (
    filas as unknown as FilaCalificacionConMateria[]
  ).map((fila) => ({
    id: fila.id,
    materiaId: fila.materia_id,
    materiaNombre: fila.materia?.nombre ?? "Materia desconocida",
    periodo: fila.periodo,
    calificacion: fila.calificacion,
    aprobado: estaAprobado(fila.calificacion),
  }));

  const promedioGeneral = calcularPromedio(
    calificaciones.map((c) => c.calificacion),
  );

  return {
    exito: true,
    kardex: { alumno: alumno as Alumno, calificaciones, promedioGeneral },
  };
}
