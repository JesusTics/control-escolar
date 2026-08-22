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
  // Datos sensibles (contacto de tutor, información médica) cifrados con
  // AES-256-GCM en la capa de aplicación (CLAUDE.md 4.4, ver
  // src/lib/cifrado/). Columnas agregadas en
  // supabase/migrations/20260822210809_datos_sensibles_alumno.sql —
  // almacenan el CIPHERTEXT, nunca el dato en claro. Nunca se exponen tal
  // cual a la UI: se descifran solo en `obtener-kardex-alumno.ts`, y solo si
  // el rol del perfil actual es `administrativo`/`oficina_central` (ver ese
  // archivo para el porqué de esta restricción adicional de aplicación).
  tutor_nombre_cifrado: string | null;
  tutor_telefono_cifrado: string | null;
  informacion_medica_cifrada: string | null;
}
