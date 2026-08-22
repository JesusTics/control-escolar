// Caso de uso: listar TODAS las solicitudes ARCO del plantel del usuario
// actual, con el nombre del solicitante — usado por el staff
// (administrativo/oficina_central) para atenderlas.
//
// La política RLS `solicitudes_arco_select_propia_o_staff` ya exige rol de
// staff para ver solicitudes ajenas — un usuario sin ese rol simplemente
// recibe solo las suyas (o ninguna), no un error, mismo comportamiento que
// el resto de módulos con RLS de staff (ver `listar-invitaciones.ts`).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SolicitudArcoConSolicitante } from "../dominio/solicitud-arco";

export type ResultadoSolicitudesArcoPlantel =
  | { exito: true; solicitudes: SolicitudArcoConSolicitante[] }
  | { exito: false; error: string };

interface FilaSolicitudConSolicitante {
  id: string;
  plantel_id: string;
  solicitante_id: string;
  tipo: SolicitudArcoConSolicitante["tipo"];
  descripcion: string;
  estado: SolicitudArcoConSolicitante["estado"];
  respuesta: string | null;
  atendida_por: string | null;
  created_at: string;
  resuelta_en: string | null;
  solicitante: { nombre_completo: string } | null;
}

export async function listarSolicitudesArcoPlantel(
  supabase: SupabaseClient,
): Promise<ResultadoSolicitudesArcoPlantel> {
  const { data, error } = await supabase
    .from("solicitudes_arco")
    .select(
      "id, plantel_id, solicitante_id, tipo, descripcion, estado, respuesta, atendida_por, created_at, resuelta_en, solicitante:perfiles!solicitudes_arco_solicitante_id_fkey(nombre_completo)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { exito: false, error: error.message };
  }

  const solicitudes: SolicitudArcoConSolicitante[] = (
    data as unknown as FilaSolicitudConSolicitante[]
  ).map((fila) => ({
    id: fila.id,
    plantel_id: fila.plantel_id,
    solicitante_id: fila.solicitante_id,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    estado: fila.estado,
    respuesta: fila.respuesta,
    atendida_por: fila.atendida_por,
    created_at: fila.created_at,
    resuelta_en: fila.resuelta_en,
    solicitanteNombre: fila.solicitante?.nombre_completo ?? "Usuario desconocido",
  }));

  return { exito: true, solicitudes };
}
