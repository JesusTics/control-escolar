"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { registrarAsistenciaDelDia } from "@/modules/asistencia/casos-uso/registrar-asistencia-del-dia";
import type { EstadoAsistencia } from "@/modules/asistencia/dominio/asistencia";

export interface EstadoRegistrarAsistencia {
  error?: string;
  exito?: boolean;
}

const ESTADOS_VALIDOS: EstadoAsistencia[] = [
  "presente",
  "ausente",
  "retardo",
  "justificado",
];

export async function registrarAsistenciaAction(
  _estadoPrevio: EstadoRegistrarAsistencia,
  formData: FormData,
): Promise<EstadoRegistrarAsistencia> {
  const fecha = String(formData.get("fecha") ?? "").trim();
  const alumnoIds = formData.getAll("alumnoId").map((valor) => String(valor));

  if (!fecha) {
    return { error: "La fecha es obligatoria." };
  }

  const registros = alumnoIds.map((alumnoId) => {
    const estadoTexto = String(
      formData.get(`estado-${alumnoId}`) ?? "presente",
    );
    const estado = ESTADOS_VALIDOS.includes(estadoTexto as EstadoAsistencia)
      ? (estadoTexto as EstadoAsistencia)
      : "presente";
    return { alumnoId, estado };
  });

  const supabase = await crearClienteServidor();
  const resultado = await registrarAsistenciaDelDia(supabase, {
    fecha,
    registros,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  return { exito: true };
}
