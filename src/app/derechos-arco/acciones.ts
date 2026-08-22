"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearSolicitudArco } from "@/modules/identidad/casos-uso/crear-solicitud-arco";
import type { TipoSolicitudArco } from "@/modules/identidad/dominio/solicitud-arco";

export interface EstadoCrearSolicitudArco {
  error?: string;
  mensaje?: string;
}

const TIPOS_VALIDOS: TipoSolicitudArco[] = [
  "acceso",
  "rectificacion",
  "cancelacion",
  "oposicion",
];

export async function crearSolicitudArcoAction(
  _estadoPrevio: EstadoCrearSolicitudArco,
  formData: FormData,
): Promise<EstadoCrearSolicitudArco> {
  const tipoTexto = String(formData.get("tipo") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (!TIPOS_VALIDOS.includes(tipoTexto as TipoSolicitudArco)) {
    return { error: "Selecciona un tipo de solicitud válido." };
  }

  if (!descripcion) {
    return { error: "Describe tu solicitud." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await crearSolicitudArco(supabase, {
    tipo: tipoTexto as TipoSolicitudArco,
    descripcion,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  // Sin redirect a propósito: esta pantalla muestra el formulario y la lista
  // de solicitudes propias en la misma página, mismo criterio que
  // `/plantel/invitaciones`. `revalidatePath` refresca el listado del Server
  // Component al reenviar el formulario.
  revalidatePath("/derechos-arco");
  return {
    mensaje:
      "Solicitud enviada. El personal administrativo de tu plantel la revisará.",
  };
}
