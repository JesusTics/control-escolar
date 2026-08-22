// Caso de uso: listar las solicitudes ARCO del usuario autenticado actual
// (más recientes primero) — para que vea el estado de las suyas.
//
// Sin lógica de negocio propia más allá de la consulta — la política RLS
// `solicitudes_arco_select_propia_o_staff` ya filtra por
// `solicitante_id = auth.uid()` para cualquier rol; aquí solo se filtra
// explícito además por claridad de intención (y para no depender solo de
// RLS si la política cambiara a futuro).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SolicitudArco } from "../dominio/solicitud-arco";

export type ResultadoMisSolicitudesArco =
  | { exito: true; solicitudes: SolicitudArco[] }
  | { exito: false; error: string };

export async function listarMisSolicitudesArco(
  supabase: SupabaseClient,
): Promise<ResultadoMisSolicitudesArco> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      exito: false,
      error: "Debes iniciar sesión para ver tus solicitudes.",
    };
  }

  const { data, error } = await supabase
    .from("solicitudes_arco")
    .select("*")
    .eq("solicitante_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { exito: false, error: error.message };
  }

  return { exito: true, solicitudes: data as SolicitudArco[] };
}
