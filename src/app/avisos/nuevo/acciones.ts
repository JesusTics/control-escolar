"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { publicarAviso } from "@/modules/comunicacion/casos-uso/publicar-aviso";
import type { DirigidoA } from "@/modules/comunicacion/dominio/aviso";

export interface EstadoPublicarAviso {
  error?: string;
}

const DIRIGIDOS_A_VALIDOS: DirigidoA[] = ["todos", "docentes", "alumnos"];

export async function publicarAvisoAction(
  _estadoPrevio: EstadoPublicarAviso,
  formData: FormData,
): Promise<EstadoPublicarAviso> {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const contenido = String(formData.get("contenido") ?? "").trim();
  const dirigidoATexto = String(formData.get("dirigidoA") ?? "todos");
  const dirigidoA = DIRIGIDOS_A_VALIDOS.includes(dirigidoATexto as DirigidoA)
    ? (dirigidoATexto as DirigidoA)
    : "todos";

  if (!titulo || !contenido) {
    return { error: "El título y el contenido son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await publicarAviso(supabase, {
    titulo,
    contenido,
    dirigidoA,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect("/avisos");
}
