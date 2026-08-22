"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resolverSolicitudArco } from "@/modules/identidad/casos-uso/resolver-solicitud-arco";

export interface EstadoResolverSolicitudArco {
  error?: string;
  exito?: boolean;
}

// Recibe `solicitudId` como primer argumento pre-vinculado desde el
// componente cliente (`.bind(null, solicitudId)`), para poder tener un
// formulario independiente por fila en la lista sin duplicar la Server
// Action ni depender de un formulario global con múltiples botones.
export async function resolverSolicitudArcoAction(
  solicitudId: string,
  _estadoPrevio: EstadoResolverSolicitudArco,
  formData: FormData,
): Promise<EstadoResolverSolicitudArco> {
  const respuesta = String(formData.get("respuesta") ?? "").trim();

  if (!respuesta) {
    return { error: "Escribe una respuesta antes de resolver la solicitud." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await resolverSolicitudArco(supabase, {
    solicitudId,
    respuesta,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  revalidatePath("/plantel/solicitudes-arco");
  return { exito: true };
}
