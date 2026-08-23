// Caso de uso: registrar (o corregir) la calificación de un alumno en una
// materia y periodo determinados.
//
// Recibe el cliente de Supabase ya instanciado, siguiendo el mismo patrón
// que el resto de casos de uso del proyecto.
//
// Reglas de negocio validadas aquí:
// - `calificacion` debe estar entre 0 y 10 (misma escala que el `check` de
//   la tabla, validado también aquí para dar un mensaje de negocio claro en
//   vez de depender solo del error crudo de Postgres).
// - Se usa `.upsert()` con `onConflict: 'alumno_id,materia_id,periodo'` en
//   vez de `.insert()`: volver a capturar la misma materia/periodo para un
//   alumno debe actualizar la calificación existente, no fallar por
//   violación de unicidad — es el comportamiento esperado cuando un docente
//   corrige una nota ya capturada (ver alcance explícito de la tarea: no hay
//   edición/borrado separados, re-registrar ES la forma de editar).
// - Un docente solo puede registrar calificaciones de una materia que tenga
//   asignada (`public.docente_materias`, ver
//   supabase/migrations/20260823000049_asignacion_docente_materia.sql) — lo
//   exigen las políticas RLS `calificaciones_insert/update_staff_o_docente_
//   asignado`; si de todos modos ocurre (ej. petición directa a una materia
//   no asignada), el 42501 crudo de Postgres se traduce aquí al mensaje de
//   negocio "No tienes esta materia asignada" en vez de dejarlo pasar tal
//   cual, mismo criterio que el resto del proyecto.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Calificacion } from "../dominio/calificacion";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosRegistrarCalificacion {
  alumnoId: string;
  materiaId: string;
  periodo: string;
  calificacion: number;
}

export type ResultadoRegistrarCalificacion =
  | { exito: true; calificacion: Calificacion }
  | { exito: false; error: string };

export async function registrarCalificacion(
  supabase: SupabaseClient,
  datos: DatosRegistrarCalificacion,
): Promise<ResultadoRegistrarCalificacion> {
  const periodo = datos.periodo.trim();

  if (!datos.alumnoId || !datos.materiaId || !periodo) {
    return {
      exito: false,
      error: "Alumno, materia y periodo son obligatorios.",
    };
  }

  if (
    Number.isNaN(datos.calificacion) ||
    datos.calificacion < 0 ||
    datos.calificacion > 10
  ) {
    return {
      exito: false,
      error: "La calificación debe ser un número entre 0 y 10.",
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

  const { data, error } = await supabase
    .from("calificaciones")
    .upsert(
      {
        plantel_id: resultadoPerfil.perfil.plantel_id,
        alumno_id: datos.alumnoId,
        materia_id: datos.materiaId,
        periodo,
        calificacion: datos.calificacion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alumno_id,materia_id,periodo" },
    )
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error:
          "No tienes esta materia asignada. Si crees que es un error, contacta al personal administrativo de tu plantel.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, calificacion: data as Calificacion };
}
