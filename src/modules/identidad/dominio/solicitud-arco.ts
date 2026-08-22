// Tipos de dominio del bounded context Identidad/Roles — derechos ARCO
// (acceso, rectificación, cancelación, oposición), exigidos por CLAUDE.md 4.4
// / LFPDPPP. Reflejan la forma de la tabla `public.solicitudes_arco`
// definida en `supabase/migrations/20260822214000_solicitudes_arco.sql`.
//
// Esta tabla es el CANAL formal de la solicitud, no la ejecución automática:
// "cancelación" no borra datos por sí sola, el staff la atiende
// manualmente (dar de baja un alumno, corregir un dato, etc.) y luego marca
// la solicitud como resuelta con una respuesta de texto.

export type TipoSolicitudArco =
  | "acceso"
  | "rectificacion"
  | "cancelacion"
  | "oposicion";

export type EstadoSolicitudArco = "pendiente" | "resuelta";

export interface SolicitudArco {
  id: string;
  plantel_id: string;
  solicitante_id: string;
  tipo: TipoSolicitudArco;
  descripcion: string;
  estado: EstadoSolicitudArco;
  respuesta: string | null;
  atendida_por: string | null;
  created_at: string;
  resuelta_en: string | null;
}

export interface SolicitudArcoConSolicitante extends SolicitudArco {
  solicitanteNombre: string;
}
