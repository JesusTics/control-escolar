"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { aceptarInvitacion } from "@/modules/identidad/casos-uso/aceptar-invitacion";

export interface EstadoAceptarInvitacion {
  error?: string;
}

export async function aceptarInvitacionAction(
  _estadoPrevio: EstadoAceptarInvitacion,
  formData: FormData,
): Promise<EstadoAceptarInvitacion> {
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombreCompleto = String(formData.get("nombreCompleto") ?? "").trim();

  if (!token || !email || !password || !nombreCompleto) {
    return { error: "Completa todos los campos." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await aceptarInvitacion(supabase, {
    token,
    email,
    password,
    nombreCompleto,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect("/dashboard");
}
