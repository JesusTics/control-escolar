"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { registrarCalificacion } from "@/modules/calificaciones/casos-uso/registrar-calificacion";

export interface EstadoRegistrarCalificacion {
  error?: string;
}

export async function registrarCalificacionAction(
  alumnoId: string,
  _estadoPrevio: EstadoRegistrarCalificacion,
  formData: FormData,
): Promise<EstadoRegistrarCalificacion> {
  const grupoId = String(formData.get("grupoId") ?? "").trim();
  const calificacionTexto = String(formData.get("calificacion") ?? "").trim();
  const calificacion = Number(calificacionTexto);

  if (!grupoId || !calificacionTexto) {
    return { error: "Grupo y calificación son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await registrarCalificacion(supabase, {
    alumnoId,
    grupoId,
    calificacion,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect(`/alumnos/${alumnoId}`);
}
