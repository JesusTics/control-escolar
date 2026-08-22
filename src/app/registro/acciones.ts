"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { registrarPlantelInicial } from "@/modules/identidad/casos-uso/registrar-plantel-inicial";

export interface EstadoRegistro {
  error?: string;
  mensaje?: string;
}

export async function registrarseAction(
  _estadoPrevio: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const nombrePlantel = String(formData.get("nombrePlantel") ?? "").trim();
  const nombreCompleto = String(formData.get("nombreCompleto") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nombrePlantel || !nombreCompleto || !email || !password) {
    return { error: "Completa todos los campos." };
  }

  const supabase = await crearClienteServidor();

  const { data, error: errorRegistro } = await supabase.auth.signUp({
    email,
    password,
  });

  if (errorRegistro) {
    return { error: errorRegistro.message };
  }

  if (!data.session) {
    // Confirmación de correo activada en el proyecto de Supabase: no hay
    // sesión inmediata tras signUp, así que todavía no se puede llamar al
    // RPC de alta (requiere auth.uid()). Se informa al usuario en vez de
    // fallar silenciosamente; el plantel/perfil queda pendiente de crear la
    // próxima vez que inicie sesión ya confirmado (ver nota en
    // src/app/dashboard/page.tsx sobre este caso).
    return {
      mensaje:
        "Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.",
    };
  }

  const resultado = await registrarPlantelInicial(supabase, {
    nombrePlantel,
    nombreCompleto,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect("/dashboard");
}
