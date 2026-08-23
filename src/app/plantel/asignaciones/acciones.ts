"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { asignarDocenteMateria } from "@/modules/calificaciones/casos-uso/asignar-docente-materia";
import { desasignarDocenteMateria } from "@/modules/calificaciones/casos-uso/desasignar-docente-materia";

export interface EstadoAsignarDocenteMateria {
  error?: string;
  mensaje?: string;
}

export async function asignarDocenteMateriaAction(
  _estadoPrevio: EstadoAsignarDocenteMateria,
  formData: FormData,
): Promise<EstadoAsignarDocenteMateria> {
  const docenteId = String(formData.get("docente_id") ?? "").trim();
  const materiaId = String(formData.get("materia_id") ?? "").trim();

  if (!docenteId || !materiaId) {
    return { error: "Selecciona un docente y una materia." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await asignarDocenteMateria(supabase, {
    docenteId,
    materiaId,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  // Sin redirect a propósito: esta pantalla muestra el formulario y la lista
  // de asignaciones en la misma página, mismo criterio que
  // `/plantel/invitaciones`. `revalidatePath` refresca el listado del Server
  // Component al reenviar el formulario.
  revalidatePath("/plantel/asignaciones");
  return { mensaje: "Materia asignada correctamente." };
}

export interface EstadoDesasignarDocenteMateria {
  error?: string;
}

// Recibe `asignacionId` como primer argumento pre-vinculado desde el
// componente cliente (`.bind(null, asignacionId)`), mismo patrón que
// `resolverSolicitudArcoAction` — un botón/formulario independiente por fila
// en la lista, sin duplicar la Server Action.
// Firma requerida por useActionState (prevState, formData), aunque este
// formulario no tiene campos: no necesita ni el estado previo ni el
// FormData, solo el asignacionId pre-vinculado.
export async function desasignarDocenteMateriaAction(
  asignacionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoPrevio: EstadoDesasignarDocenteMateria,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDesasignarDocenteMateria> {
  const supabase = await crearClienteServidor();
  const resultado = await desasignarDocenteMateria(supabase, asignacionId);

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  revalidatePath("/plantel/asignaciones");
  return {};
}
