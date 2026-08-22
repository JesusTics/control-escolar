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
}
