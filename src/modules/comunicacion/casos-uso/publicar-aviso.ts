// Caso de uso: publicar un aviso nuevo en el tablón del plantel del usuario
// actual.
//
// Recibe el cliente de Supabase ya instanciado (inyectado desde el Server
// Action que lo llama), siguiendo el mismo patrón que
// `src/modules/alumnos/casos-uso/inscribir-alumno.ts`.
//
// Reglas de negocio validadas aquí (más allá del CRUD directo a Supabase):
// - `titulo` y `contenido` no pueden estar vacíos.
// - `autor_id` se toma del usuario autenticado actual, nunca de un valor de
//   formulario — mismo criterio que `plantel_id` en el resto de módulos: la
//   fuente de verdad es siempre la sesión, no un dato enviado por el cliente.
// - Solo alta (sin edición/borrado) — ver alcance explícito de la sesión en
//   docs/ARCHITECTURE.md, sección "Comunicación".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Aviso, DirigidoA } from "../dominio/aviso";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

export interface DatosPublicarAviso {
  titulo: string;
  contenido: string;
  dirigidoA?: DirigidoA;
}

export type ResultadoPublicarAviso =
  | { exito: true; aviso: Aviso }
  | { exito: false; error: string };

export async function publicarAviso(
  supabase: SupabaseClient,
  datos: DatosPublicarAviso,
): Promise<ResultadoPublicarAviso> {
  const titulo = datos.titulo.trim();
  const contenido = datos.contenido.trim();

  if (!titulo || !contenido) {
    return { exito: false, error: "El título y el contenido son obligatorios." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { exito: false, error: "Debes iniciar sesión para publicar un aviso." };
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
    .from("avisos")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      autor_id: user.id,
      titulo,
      contenido,
      dirigido_a: datos.dirigidoA ?? "todos",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para publicar avisos.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, aviso: data as Aviso };
}
