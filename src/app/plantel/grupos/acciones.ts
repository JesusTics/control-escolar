"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearGrupo } from "@/modules/grupos/casos-uso/crear-grupo";

export interface EstadoCrearGrupo {
  error?: string;
  mensaje?: string;
}

export async function crearGrupoAction(
  _estadoPrevio: EstadoCrearGrupo,
  formData: FormData,
): Promise<EstadoCrearGrupo> {
  const materiaId = String(formData.get("materia_id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const periodo = String(formData.get("periodo") ?? "").trim();
  const docenteId = String(formData.get("docente_id") ?? "").trim();

  if (!materiaId || !nombre || !periodo) {
    return {
      error: "Materia, nombre del grupo y periodo son obligatorios.",
    };
  }

  const supabase = await crearClienteServidor();
  const resultado = await crearGrupo(supabase, {
    materiaId,
    nombre,
    periodo,
    docenteId: docenteId || undefined,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  // Sin redirect a propósito: esta pantalla muestra el formulario y la
  // lista de grupos en la misma página, mismo criterio que
  // `/plantel/invitaciones`. `revalidatePath` refresca el listado del Server
  // Component al reenviar el formulario.
  revalidatePath("/plantel/grupos");
  return { mensaje: "Grupo creado correctamente." };
}
