"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { actualizarDatosSensiblesAlumno } from "@/modules/alumnos/casos-uso/actualizar-datos-sensibles-alumno";

export interface EstadoActualizarDatosSensibles {
  error?: string;
}

// Mismo criterio de roles que la página (page.tsx) y que
// obtener-kardex-alumno.ts — se vuelve a verificar aquí porque el Server
// Action es un endpoint independiente: no basta con que la página oculte el
// formulario, alguien podría invocar la acción directamente.
const ROLES_CON_ACCESO = ["administrativo", "oficina_central"];

export async function actualizarDatosSensiblesAction(
  alumnoId: string,
  _estadoPrevio: EstadoActualizarDatosSensibles,
  formData: FormData,
): Promise<EstadoActualizarDatosSensibles> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultadoPerfil = await obtenerPerfilActual(supabase);
  if (!resultadoPerfil.exito) {
    return { error: resultadoPerfil.error };
  }

  const { perfil } = resultadoPerfil;

  if (!perfil || !ROLES_CON_ACCESO.includes(perfil.rol)) {
    return {
      error: "No tienes permiso para editar los datos sensibles de este alumno.",
    };
  }

  // Un campo dejado en blanco en el formulario se trata como "no capturado"
  // (no se toca esa columna), no como "cifrar una cadena vacía" — es la
  // forma natural de que un formulario de edición represente "sin dato" sin
  // forzar a llenar los tres campos siempre (ver comentario de
  // actualizar-datos-sensibles-alumno.ts).
  const normalizar = (valor: FormDataEntryValue | null): string | undefined => {
    const texto = String(valor ?? "").trim();
    return texto === "" ? undefined : texto;
  };

  const resultado = await actualizarDatosSensiblesAlumno(supabase, {
    alumnoId,
    tutorNombre: normalizar(formData.get("tutorNombre")),
    tutorTelefono: normalizar(formData.get("tutorTelefono")),
    informacionMedica: normalizar(formData.get("informacionMedica")),
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect(`/alumnos/${alumnoId}`);
}
