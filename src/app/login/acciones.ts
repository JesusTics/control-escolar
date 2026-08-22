"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { iniciarSesion } from "@/modules/identidad/casos-uso/iniciar-sesion";

export interface EstadoInicioSesion {
  error?: string;
}

export async function iniciarSesionAction(
  _estadoPrevio: EstadoInicioSesion,
  formData: FormData,
): Promise<EstadoInicioSesion> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completa tu correo y contraseña." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await iniciarSesion(supabase, { email, password });

  if (!resultado.exito) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}
