"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { asignarDocenteGrupo } from "@/modules/grupos/casos-uso/asignar-docente-grupo";
import { inscribirAlumnoGrupo } from "@/modules/grupos/casos-uso/inscribir-alumno-grupo";
import { desinscribirAlumnoGrupo } from "@/modules/grupos/casos-uso/desinscribir-alumno-grupo";

export interface EstadoCambiarDocenteGrupo {
  error?: string;
  mensaje?: string;
}

export async function cambiarDocenteGrupoAction(
  grupoId: string,
  _estadoPrevio: EstadoCambiarDocenteGrupo,
  formData: FormData,
): Promise<EstadoCambiarDocenteGrupo> {
  const docenteId = String(formData.get("docente_id") ?? "").trim();

  const supabase = await crearClienteServidor();
  const resultado = await asignarDocenteGrupo(supabase, {
    grupoId,
    docenteId: docenteId || null,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  revalidatePath(`/plantel/grupos/${grupoId}`);
  return { mensaje: "Docente actualizado." };
}

export interface EstadoInscribirAlumno {
  error?: string;
  mensaje?: string;
}

export async function inscribirAlumnoAction(
  grupoId: string,
  _estadoPrevio: EstadoInscribirAlumno,
  formData: FormData,
): Promise<EstadoInscribirAlumno> {
  const alumnoId = String(formData.get("alumno_id") ?? "").trim();

  if (!alumnoId) {
    return { error: "Selecciona un alumno." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await inscribirAlumnoGrupo(supabase, {
    alumnoId,
    grupoId,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  revalidatePath(`/plantel/grupos/${grupoId}`);
  return { mensaje: "Alumno inscrito correctamente." };
}

export interface EstadoDesinscribirAlumno {
  error?: string;
}

// Recibe `inscripcionId` y `grupoId` pre-vinculados desde el componente
// cliente (`.bind(null, inscripcionId, grupoId)`), mismo patrón que
// `resolverSolicitudArcoAction`.
export async function desinscribirAlumnoAction(
  inscripcionId: string,
  grupoId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoPrevio: EstadoDesinscribirAlumno,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDesinscribirAlumno> {
  const supabase = await crearClienteServidor();
  const resultado = await desinscribirAlumnoGrupo(supabase, inscripcionId);

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  revalidatePath(`/plantel/grupos/${grupoId}`);
  return {};
}
