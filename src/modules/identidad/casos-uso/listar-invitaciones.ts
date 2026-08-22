// Caso de uso: listar las invitaciones del plantel del usuario actual, con
// su estado derivado (pendiente/usada/expirada).
//
// El estado no vive en la base de datos como columna propia — se calcula
// aquí a partir de `usada_en`/`expira_en` (ver diseño de la sesión: "no en
// la UI"), para que la UI solo pinte el estado ya resuelto sin duplicar esta
// regla. La RLS de `public.invitaciones` (política
// `invitaciones_select_staff_mismo_plantel`) ya filtra por plantel y exige
// rol de staff — un usuario sin ese rol simplemente recibe una lista vacía,
// no un error (mismo comportamiento que RLS en el resto de módulos).
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EstadoInvitacion,
  Invitacion,
  InvitacionConEstado,
} from "../dominio/invitacion";

export type ResultadoListaInvitaciones =
  | { exito: true; invitaciones: InvitacionConEstado[] }
  | { exito: false; error: string };

function derivarEstado(invitacion: Invitacion): EstadoInvitacion {
  if (invitacion.usada_en) {
    return "usada";
  }

  if (new Date(invitacion.expira_en) <= new Date()) {
    return "expirada";
  }

  return "pendiente";
}

export async function listarInvitaciones(
  supabase: SupabaseClient,
): Promise<ResultadoListaInvitaciones> {
  const { data, error } = await supabase
    .from("invitaciones")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { exito: false, error: error.message };
  }

  const invitaciones: InvitacionConEstado[] = (data as Invitacion[]).map(
    (invitacion) => ({
      ...invitacion,
      estado: derivarEstado(invitacion),
    }),
  );

  return { exito: true, invitaciones };
}
