// Caso de uso: crear una solicitud de derechos ARCO (acceso, rectificación,
// cancelación, oposición) sobre los propios datos del usuario actual.
//
// Cualquier usuario autenticado (de cualquier rol) puede crear una solicitud
// sobre sí mismo — a diferencia de otros casos de uso de alta del proyecto,
// no hay restricción de rol, ni de la política RLS ni de este caso de uso.
// `solicitante_id`/`plantel_id` se resuelven desde la sesión actual, nunca
// de un valor de formulario, mismo criterio que el resto de módulos.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SolicitudArco, TipoSolicitudArco } from "../dominio/solicitud-arco";
import { obtenerPerfilActual } from "./obtener-perfil-actual";

const TIPOS_VALIDOS: TipoSolicitudArco[] = [
  "acceso",
  "rectificacion",
  "cancelacion",
  "oposicion",
];

export interface DatosCrearSolicitudArco {
  tipo: TipoSolicitudArco;
  descripcion: string;
}

export type ResultadoCrearSolicitudArco =
  | { exito: true; solicitud: SolicitudArco }
  | { exito: false; error: string };

export async function crearSolicitudArco(
  supabase: SupabaseClient,
  datos: DatosCrearSolicitudArco,
): Promise<ResultadoCrearSolicitudArco> {
  const descripcion = datos.descripcion.trim();

  if (!TIPOS_VALIDOS.includes(datos.tipo)) {
    return { exito: false, error: "Selecciona un tipo de solicitud válido." };
  }

  if (!descripcion) {
    return { exito: false, error: "Describe tu solicitud." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      exito: false,
      error: "Debes iniciar sesión para levantar una solicitud.",
    };
  }

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    return { exito: false, error: resultadoPerfil.error };
  }

  if (!resultadoPerfil.perfil) {
    return {
      exito: false,
      error: "Tu cuenta todavía no tiene un plantel asociado.",
    };
  }

  const { data, error } = await supabase
    .from("solicitudes_arco")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      solicitante_id: user.id,
      tipo: datos.tipo,
      descripcion,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para crear esta solicitud.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, solicitud: data as SolicitudArco };
}
