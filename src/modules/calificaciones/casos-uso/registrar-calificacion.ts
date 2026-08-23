// Caso de uso: registrar (o corregir) la calificación de un alumno en un
// grupo determinado (el grupo ya trae materia y periodo, ver
// src/modules/grupos/dominio/grupo.ts).
//
// Recibe el cliente de Supabase ya instanciado, siguiendo el mismo patrón
// que el resto de casos de uso del proyecto.
//
// Reglas de negocio validadas aquí:
// - `calificacion` debe estar entre 0 y 10 (misma escala que el `check` de
//   la tabla, validado también aquí para dar un mensaje de negocio claro en
//   vez de depender solo del error crudo de Postgres).
// - Se usa `.upsert()` con `onConflict: 'alumno_id,grupo_id'` en vez de
//   `.insert()`: volver a capturar el mismo grupo para un alumno debe
//   actualizar la calificación existente, no fallar por violación de
//   unicidad — es el comportamiento esperado cuando un docente corrige una
//   nota ya capturada (ver alcance explícito de la tarea: no hay
//   edición/borrado separados, re-registrar ES la forma de editar).
// - El alumno debe estar inscrito en el grupo (`public.inscripciones`) — lo
//   exige la política RLS `calificaciones_insert_staff_o_docente_grupo`
//   (`exists ... inscripciones`), y un docente solo puede calificar en un
//   grupo donde es `grupos.docente_id` — ambas condiciones viven en el mismo
//   WITH CHECK, así que Postgres devuelve 42501 para las dos; se distinguen
//   aquí consultando `grupos.docente_id` (visible para cualquiera del
//   plantel vía `grupos_select_mismo_plantel`, sin restricción de rol) para
//   dar el mensaje de negocio correcto en cada caso.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Calificacion } from "../dominio/calificacion";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosRegistrarCalificacion {
  alumnoId: string;
  grupoId: string;
  calificacion: number;
}

export type ResultadoRegistrarCalificacion =
  | { exito: true; calificacion: Calificacion }
  | { exito: false; error: string };

const ROLES_STAFF = new Set(["administrativo", "oficina_central"]);

export async function registrarCalificacion(
  supabase: SupabaseClient,
  datos: DatosRegistrarCalificacion,
): Promise<ResultadoRegistrarCalificacion> {
  if (!datos.alumnoId || !datos.grupoId) {
    return {
      exito: false,
      error: "Alumno y grupo son obligatorios.",
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
        grupo_id: datos.grupoId,
        calificacion: datos.calificacion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alumno_id,grupo_id" },
    )
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      if (!ROLES_STAFF.has(resultadoPerfil.perfil.rol)) {
        const { data: grupo } = await supabase
          .from("grupos")
          .select("docente_id")
          .eq("id", datos.grupoId)
          .maybeSingle();

        if (!grupo || grupo.docente_id !== resultadoPerfil.perfil.id) {
          return {
            exito: false,
            error: "No tienes este grupo asignado.",
          };
        }
      }

      return {
        exito: false,
        error: "Este alumno no está inscrito en este grupo.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, calificacion: data as Calificacion };
}
