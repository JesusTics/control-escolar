// Tipos de dominio del bounded context Identidad/Roles.
// Reflejan la forma de las tablas `public.perfiles` / `public.planteles`
// definidas en `supabase/migrations/20260822074551_fundacion_multitenant.sql`.

export type Rol = "alumno" | "docente" | "administrativo" | "oficina_central";

export interface Perfil {
  id: string;
  plantel_id: string;
  rol: Rol;
  nombre_completo: string;
  created_at: string;
}

export interface Plantel {
  id: string;
  nombre: string;
}

export interface PerfilConPlantel extends Perfil {
  plantel: Plantel | null;
}
