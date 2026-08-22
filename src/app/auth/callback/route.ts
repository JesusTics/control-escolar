// Route Handler que completa el flujo de confirmación de email de Supabase
// Auth: `/registro` guarda `nombre_plantel`/`nombre_completo` como user
// metadata y pasa esta ruta como `emailRedirectTo` (ver
// src/app/registro/acciones.ts). Cuando el usuario hace clic en el link de
// confirmación de su correo, Supabase lo trae aquí con un `code` en la query
// string.
//
// Es un Route Handler (no una Page) a propósito: no hay UI que mostrar, solo
// intercambiar el código por una sesión y redirigir — un Server Component no
// puede hacer un intercambio con efecto secundario (cookies de sesión) antes
// de decidir a dónde redirigir con la misma limpieza que un Route Handler.
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { registrarPlantelInicial } from "@/modules/identidad/casos-uso/registrar-plantel-inicial";

function redirigirALoginConError(origen: string, mensaje: string) {
  return NextResponse.redirect(
    `${origen}/login?error=${encodeURIComponent(mensaje)}`,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return redirigirALoginConError(
      origin,
      "El enlace de confirmación no es válido.",
    );
  }

  const supabase = await crearClienteServidor();
  const { error: errorIntercambio } =
    await supabase.auth.exchangeCodeForSession(code);

  if (errorIntercambio) {
    return redirigirALoginConError(
      origin,
      "El enlace de confirmación expiró o ya se usó. Inicia sesión o solicita uno nuevo.",
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirigirALoginConError(
      origin,
      "No se pudo confirmar tu cuenta. Intenta iniciar sesión.",
    );
  }

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    return redirigirALoginConError(
      origin,
      "No se pudo verificar tu perfil. Intenta iniciar sesión de nuevo.",
    );
  }

  // Si ya tiene perfil (ej. clic repetido en el link, o link llegó después
  // de haber iniciado sesión por otra vía), no se vuelve a llamar el RPC de
  // alta — `registrar-plantel-inicial` es de un solo uso por diseño (la
  // función `security definer` valida que el usuario no tenga perfil
  // todavía).
  if (!resultadoPerfil.perfil) {
    const nombrePlantel = String(
      user.user_metadata?.nombre_plantel ?? "",
    ).trim();
    const nombreCompleto = String(
      user.user_metadata?.nombre_completo ?? "",
    ).trim();

    if (!nombrePlantel || !nombreCompleto) {
      return redirigirALoginConError(
        origin,
        "Confirmamos tu correo, pero falta información para crear tu plantel. Contacta a soporte.",
      );
    }

    const resultadoAlta = await registrarPlantelInicial(supabase, {
      nombrePlantel,
      nombreCompleto,
    });

    if (!resultadoAlta.exito) {
      return redirigirALoginConError(origin, resultadoAlta.error);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
