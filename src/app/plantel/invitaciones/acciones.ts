"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearInvitacion } from "@/modules/identidad/casos-uso/crear-invitacion";
import type { RolInvitable } from "@/modules/identidad/dominio/invitacion";

export interface EstadoCrearInvitacion {
  error?: string;
  mensaje?: string;
}

const ROLES_VALIDOS: RolInvitable[] = ["administrativo", "docente", "alumno"];

export async function crearInvitacionAction(
  _estadoPrevio: EstadoCrearInvitacion,
  formData: FormData,
): Promise<EstadoCrearInvitacion> {
  const email = String(formData.get("email") ?? "").trim();
  const rolTexto = String(formData.get("rol") ?? "");
  const alumnoIdTexto = String(formData.get("alumno_id") ?? "").trim();

  if (!ROLES_VALIDOS.includes(rolTexto as RolInvitable)) {
    return { error: "Selecciona un rol válido." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await crearInvitacion(supabase, {
    email,
    rol: rolTexto as RolInvitable,
    alumnoId: alumnoIdTexto || undefined,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  // Sin redirect a propósito: esta pantalla muestra el formulario y la lista
  // de invitaciones (con el link de la recién creada) en la misma página, a
  // diferencia de "publicar aviso" que sí redirige. `revalidatePath` refresca
  // el listado del Server Component al reenviar el formulario.
  revalidatePath("/plantel/invitaciones");
  return {
    mensaje: "Invitación creada. Copia el link de la lista de abajo y compártelo.",
  };
}
