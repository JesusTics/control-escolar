// Caso de uso: actualizar los datos sensibles cifrados de un alumno (tutor,
// contacto de tutor, información médica) — ver CLAUDE.md 4.4 y
// src/lib/cifrado/.
//
// Los tres campos son opcionales de forma independiente: cualquiera puede
// venir `undefined`, y en ese caso NO se cifra ni se escribe esa columna en
// particular (`update` parcial) — no se fuerza a capturar los tres a la vez,
// ni se pisa un campo ya guardado que no vino en esta edición. Solo
// `administrativo`/`oficina_central` llegan a invocar este caso de uso (la
// UI y el Server Action que lo llaman verifican el rol antes, ver
// src/app/alumnos/[id]/datos-sensibles/) — de todas formas, si llegara a
// invocarse con otro rol, `alumnos_update_staff_mismo_plantel` (RLS) lo
// rechaza igual.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrador } from "@/lib/cifrado/instancia";

export interface DatosSensiblesAlumnoInput {
  alumnoId: string;
  tutorNombre?: string;
  tutorTelefono?: string;
  informacionMedica?: string;
}

export type ResultadoActualizarDatosSensibles =
  | { exito: true }
  | { exito: false; error: string };

export async function actualizarDatosSensiblesAlumno(
  supabase: SupabaseClient,
  datos: DatosSensiblesAlumnoInput,
): Promise<ResultadoActualizarDatosSensibles> {
  const actualizacion: Record<string, string> = {};

  if (datos.tutorNombre !== undefined) {
    actualizacion.tutor_nombre_cifrado = cifrador.cifrar(datos.tutorNombre);
  }
  if (datos.tutorTelefono !== undefined) {
    actualizacion.tutor_telefono_cifrado = cifrador.cifrar(
      datos.tutorTelefono,
    );
  }
  if (datos.informacionMedica !== undefined) {
    actualizacion.informacion_medica_cifrada = cifrador.cifrar(
      datos.informacionMedica,
    );
  }

  if (Object.keys(actualizacion).length === 0) {
    // Nada que actualizar (los tres campos venían undefined) — no vale la
    // pena una llamada de red vacía.
    return { exito: true };
  }

  const { error } = await supabase
    .from("alumnos")
    .update(actualizacion)
    .eq("id", datos.alumnoId);

  if (error) {
    // RLS rechaza el UPDATE (rol distinto de administrativo/oficina_central,
    // o alumno de otro plantel) — mismo criterio de traducción de error que
    // `inscribir-alumno.ts`.
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para editar los datos sensibles de este alumno.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true };
}
