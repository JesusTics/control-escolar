// Caso de uso: registrar (o corregir) la asistencia de un grupo en una fecha
// determinada, en una sola operación.
//
// Recibe el cliente de Supabase ya instanciado, siguiendo el mismo patrón
// que el resto de casos de uso del proyecto.
//
// Reglas de negocio validadas aquí:
// - `grupoId`, `fecha` y al menos un registro son obligatorios.
// - Se usa `.upsert()` masivo con `onConflict: 'alumno_id,grupo_id,fecha'`
//   en vez de `.insert()`: volver a capturar la asistencia del mismo grupo/
//   día para el mismo alumno corrige el registro existente en vez de fallar
//   por violación de unicidad — mismo criterio que `registrar-calificacion.ts`.
// - Una sola llamada con el arreglo completo, no una petición por alumno —
//   CLAUDE.md 7 pide explícitamente "modo asistido/wizard para... captura
//   masiva".
// - `registros` debe venir SOLO de alumnos inscritos en `grupoId` (la UI lo
//   garantiza poblando la lista con `listar-inscripciones-grupo`, no con
//   todos los alumnos del plantel) — si de todos modos llega un alumno no
//   inscrito o el usuario no tiene el grupo asignado, la política RLS
//   `asistencias_insert_staff_o_docente_grupo` rechaza el INSERT completo
//   (42501), traducido aquí a un mensaje de negocio genérico (a diferencia
//   de `registrar-calificacion.ts`, no se distingue el caso exacto por fila
//   porque esta operación es masiva).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asistencia, EstadoAsistencia } from "../dominio/asistencia";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface RegistroAsistenciaAlumno {
  alumnoId: string;
  estado: EstadoAsistencia;
}

export interface DatosRegistrarAsistenciaDelDia {
  grupoId: string;
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

  if (!datos.grupoId) {
    return { exito: false, error: "El grupo es obligatorio." };
  }

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
    grupo_id: datos.grupoId,
    fecha,
    estado: registro.estado,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("asistencias")
    .upsert(filas, { onConflict: "alumno_id,grupo_id,fecha" })
    .select();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error:
          "No tienes permiso para registrar asistencia en este grupo, o alguno de los alumnos no está inscrito en él.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, asistencias: data as Asistencia[] };
}
