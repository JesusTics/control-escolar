// Tipos de dominio del bounded context Identidad/Roles — invitaciones.
// Reflejan la forma de la tabla `public.invitaciones` definida en
// `supabase/migrations/20260822191914_invitaciones_plantel.sql`.

// Subconjunto de `Rol` (ver perfil.ts) invitable a un plantel existente —
// `oficina_central` queda fuera a propósito: no tiene sentido invitar a un
// segundo `oficina_central` en este alcance (ver diseño de la sesión).
export type RolInvitable = "administrativo" | "docente" | "alumno";

export interface Invitacion {
  id: string;
  plantel_id: string;
  email: string;
  rol: RolInvitable;
  token: string;
  creada_por: string;
  expira_en: string;
  usada_en: string | null;
  created_at: string;
}

// El estado no vive en la base de datos como columna — se deriva en el caso
// de uso (`listar-invitaciones.ts`) a partir de `usada_en`/`expira_en`, para
// no duplicar esa lógica en la UI (ver diseño de la sesión).
export type EstadoInvitacion = "pendiente" | "usada" | "expirada";

export interface InvitacionConEstado extends Invitacion {
  estado: EstadoInvitacion;
}
