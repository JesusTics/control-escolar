// Caso de uso: staff marca una solicitud ARCO como resuelta con una
// respuesta de texto.
//
// Este caso de uso NO ejecuta ninguna acción automática sobre los datos del
// solicitante (ej. no borra nada por una solicitud de "cancelación") — es
// solo el registro de que el staff ya atendió la solicitud manualmente
// (dar de baja un alumno, corregir un dato, etc., son operaciones que ya
// existen por separado o son manuales, fuera de este alcance).
//
// Se valida aquí explícitamente que el usuario actual tenga rol de staff
// antes de intentar el UPDATE — aunque la política RLS
// `solicitudes_arco_update_staff` también lo bloquea, este caso de uso debe
// dar un mensaje de negocio claro en vez de dejar que el error crudo de RLS
// (42501) llegue a la UI, mismo criterio que el resto del proyecto (ver
// `crear-invitacion.ts`, `publicar-aviso.ts`).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SolicitudArco } from "../dominio/solicitud-arco";
import { obtenerPerfilActual } from "./obtener-perfil-actual";

const ROLES_STAFF = ["administrativo", "oficina_central"];

export interface DatosResolverSolicitudArco {
  solicitudId: string;
  respuesta: string;
}

export type ResultadoResolverSolicitudArco =
  | { exito: true; solicitud: SolicitudArco }
  | { exito: false; error: string };

export async function resolverSolicitudArco(
  supabase: SupabaseClient,
  datos: DatosResolverSolicitudArco,
): Promise<ResultadoResolverSolicitudArco> {
  const respuesta = datos.respuesta.trim();

  if (!respuesta) {
    return { exito: false, error: "Escribe una respuesta antes de resolver la solicitud." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      exito: false,
      error: "Debes iniciar sesión para resolver solicitudes.",
    };
  }

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    return { exito: false, error: resultadoPerfil.error };
  }

  if (!resultadoPerfil.perfil || !ROLES_STAFF.includes(resultadoPerfil.perfil.rol)) {
    return {
      exito: false,
      error: "Solo el personal administrativo puede resolver solicitudes ARCO.",
    };
  }

  const { data, error } = await supabase
    .from("solicitudes_arco")
    .update({
      estado: "resuelta",
      respuesta,
      atendida_por: user.id,
      resuelta_en: new Date().toISOString(),
    })
    .eq("id", datos.solicitudId)
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para resolver esta solicitud.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, solicitud: data as SolicitudArco };
}
