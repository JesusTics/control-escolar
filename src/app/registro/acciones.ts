"use server";

import { headers } from "next/headers";
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

  // `nombre_plantel`/`nombre_completo` se guardan como user metadata para
  // que sigan disponibles cuando el usuario confirme su correo más tarde
  // (caso con confirmación de email activada) y `/auth/callback` los lea de
  // `user.user_metadata` sin tener que volver a pedirlos — ver
  // src/app/auth/callback/route.ts. `emailRedirectTo` apunta ahí, no a
  // `/dashboard`, porque ese Route Handler es quien completa el alta del
  // plantel/perfil antes de redirigir.
  const encabezados = await headers();
  const origen =
    encabezados.get("origin") ?? `http://${encabezados.get("host")}`;

  const { data, error: errorRegistro } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre_plantel: nombrePlantel,
        nombre_completo: nombreCompleto,
      },
      emailRedirectTo: `${origen}/auth/callback`,
    },
  });

  if (errorRegistro) {
    return { error: errorRegistro.message };
  }

  if (!data.session) {
    // Confirmación de correo activada en el proyecto de Supabase: no hay
    // sesión inmediata tras signUp, así que todavía no se puede llamar al
    // RPC de alta (requiere auth.uid()). Se informa al usuario en vez de
    // fallar silenciosamente; el plantel/perfil se termina de crear en
    // `/auth/callback` cuando el usuario haga clic en el link de
    // confirmación de su correo (lee `nombre_plantel`/`nombre_completo` de
    // los metadata guardados arriba).
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
