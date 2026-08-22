// Caso de uso: aceptar una invitación — crea la cuenta de Supabase Auth (si
// no había sesión todavía) y el perfil correspondiente (plantel_id/rol de la
// invitación) vía el RPC `aceptar_invitacion` (`security definer`, ver
// supabase/migrations/20260822191914_invitaciones_plantel.sql).
//
// Mismo patrón que `registrar-plantel-inicial`: la lógica de negocio
// (validar token, expiración, email coincidente, insertar perfil) vive en la
// función Postgres, no aquí — este caso de uso solo orquesta signUp + RPC.
//
// Limitación conocida compartida con `registrar-plantel-inicial` /
// `/auth/callback` (ver ARCHITECTURE.md, sección Identidad/Roles): si el
// proyecto de Supabase tuviera activada la confirmación de email, `signUp`
// no dejaría sesión inmediata y el RPC (que requiere `auth.uid()`) no se
// podría llamar en el mismo paso. No se resuelve de nuevo aquí — el
// resultado simplemente informa que falta confirmar el correo, sin duplicar
// el flujo de `/auth/callback` (que hoy solo conoce el alta inicial, no
// invitaciones). El proyecto de desarrollo actual no tiene la confirmación
// activada, así que este camino no bloquea el flujo normal.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "../dominio/perfil";

export interface DatosAceptarInvitacion {
  token: string;
  email: string;
  password: string;
  nombreCompleto: string;
}

export type ResultadoAceptarInvitacion =
  | { exito: true; perfil: Perfil }
  | { exito: false; error: string };

export async function aceptarInvitacion(
  supabase: SupabaseClient,
  datos: DatosAceptarInvitacion,
): Promise<ResultadoAceptarInvitacion> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { data, error: errorSignUp } = await supabase.auth.signUp({
      email: datos.email,
      password: datos.password,
    });

    if (errorSignUp) {
      return { exito: false, error: errorSignUp.message };
    }

    if (!data.session) {
      // Ver comentario de cabecera: confirmación de email activada, sin
      // sesión inmediata. No se completa el alta del perfil en este paso.
      return {
        exito: false,
        error:
          "Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego vuelve a abrir este link de invitación.",
      };
    }
  }

  const { data: perfil, error } = await supabase.rpc("aceptar_invitacion", {
    p_token: datos.token,
    p_nombre_completo: datos.nombreCompleto,
  });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, perfil: perfil as Perfil };
}
