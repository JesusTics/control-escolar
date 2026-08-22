// Caso de uso: listar los avisos del plantel del usuario actual, más
// recientes primero, con el nombre del autor.
//
// Sin lógica de negocio propia más allá de la consulta — la RLS de
// `public.avisos` (política `avisos_select_mismo_plantel`) ya filtra por
// plantel, pero igual se recibe el cliente inyectado siguiendo el mismo
// patrón que el resto de casos de uso del proyecto.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DirigidoA } from "../dominio/aviso";

export interface AvisoConAutor {
  id: string;
  titulo: string;
  contenido: string;
  dirigido_a: DirigidoA;
  created_at: string;
  autorNombre: string;
}

export type ResultadoListaAvisos =
  | { exito: true; avisos: AvisoConAutor[] }
  | { exito: false; error: string };

interface FilaAvisoConAutor {
  id: string;
  titulo: string;
  contenido: string;
  dirigido_a: DirigidoA;
  created_at: string;
  autor: { nombre_completo: string } | null;
}

export async function listarAvisos(
  supabase: SupabaseClient,
): Promise<ResultadoListaAvisos> {
  const { data, error } = await supabase
    .from("avisos")
    .select(
      "id, titulo, contenido, dirigido_a, created_at, autor:perfiles(nombre_completo)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { exito: false, error: error.message };
  }

  const avisos: AvisoConAutor[] = (data as unknown as FilaAvisoConAutor[]).map(
    (fila) => ({
      id: fila.id,
      titulo: fila.titulo,
      contenido: fila.contenido,
      dirigido_a: fila.dirigido_a,
      created_at: fila.created_at,
      autorNombre: fila.autor?.nombre_completo ?? "Autor desconocido",
    }),
  );

  return { exito: true, avisos };
}
