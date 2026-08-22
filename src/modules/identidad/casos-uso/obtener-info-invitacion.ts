// Caso de uso: obtener la información pública mínima de una invitación por
// su token, para renderizar la pantalla de aceptación (`/invitacion/[token]`)
// antes de que la persona invitada tenga sesión o perfil.
//
// Llama al RPC `obtener_invitacion_publica` (`security definer`, ver
// supabase/migrations/20260822191914_invitaciones_plantel.sql) en vez de un
// `select` directo contra `invitaciones` — esa tabla no tiene política de
// SELECT para usuarios anónimos ni para el propio invitado (solo staff del
// plantel puede leerla), así que un `select` directo siempre devolvería
// vacío. El RPC expone deliberadamente solo lo necesario (nombre del
// plantel, rol, email, si sigue vigente), nada más de la fila.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InfoInvitacionPublica {
  plantelNombre: string;
  rol: string;
  email: string;
  valida: boolean;
}

export type ResultadoInfoInvitacion =
  | { exito: true; info: InfoInvitacionPublica | null }
  | { exito: false; error: string };

interface FilaInvitacionPublica {
  plantel_nombre: string;
  rol: string;
  email: string;
  valida: boolean;
}

export async function obtenerInfoInvitacion(
  supabase: SupabaseClient,
  token: string,
): Promise<ResultadoInfoInvitacion> {
  const { data, error } = await supabase.rpc("obtener_invitacion_publica", {
    p_token: token,
  });

  if (error) {
    return { exito: false, error: error.message };
  }

  // El RPC declara `returns table(...)`, así que el SDK siempre devuelve un
  // arreglo (vacío si el token no existe en `invitaciones`).
  const fila = (data as FilaInvitacionPublica[] | null)?.[0];

  if (!fila) {
    return { exito: true, info: null };
  }

  return {
    exito: true,
    info: {
      plantelNombre: fila.plantel_nombre,
      rol: fila.rol,
      email: fila.email,
      valida: fila.valida,
    },
  };
}
