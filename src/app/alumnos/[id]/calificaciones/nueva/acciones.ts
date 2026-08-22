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
  const materiaId = String(formData.get("materiaId") ?? "").trim();
  const periodo = String(formData.get("periodo") ?? "").trim();
  const calificacionTexto = String(formData.get("calificacion") ?? "").trim();
  const calificacion = Number(calificacionTexto);

  if (!materiaId || !periodo || !calificacionTexto) {
    return { error: "Materia, periodo y calificación son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await registrarCalificacion(supabase, {
    alumnoId,
    materiaId,
    periodo,
    calificacion,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect(`/alumnos/${alumnoId}`);
}
