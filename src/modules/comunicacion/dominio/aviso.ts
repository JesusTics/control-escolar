// Tipos de dominio del bounded context Comunicación.
// Reflejan la forma de la tabla `public.avisos` definida en
// `supabase/migrations/20260822191115_avisos_tablon.sql`.

export type DirigidoA = "todos" | "docentes" | "alumnos";

export interface Aviso {
  id: string;
  plantel_id: string;
  autor_id: string;
  titulo: string;
  contenido: string;
  dirigido_a: DirigidoA;
  created_at: string;
}
