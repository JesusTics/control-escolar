// Tipos de dominio del bounded context Alumnos.
// Reflejan la forma de la tabla `public.alumnos` definida en
// `supabase/migrations/20260822165852_alumnos_alta_y_listado.sql`.

export type EstadoAlumno = "activo" | "inactivo";

export interface Alumno {
  id: string;
  plantel_id: string;
  matricula: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  estado: EstadoAlumno;
  created_at: string;
  // Perfil de Identidad/Roles vinculado a este alumno (rol `alumno`), si ya
  // aceptó una invitación con `alumno_id` — `null` mientras no exista esa
  // cuenta. Columna agregada en
  // supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql, es la
  // base de la RLS que restringe a un `alumno` a ver solo su propia fila
  // (ver 20260822200144_endurecer_rls_visibilidad_por_rol.sql).
  perfil_id: string | null;
}
