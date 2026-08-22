"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearMateria } from "@/modules/calificaciones/casos-uso/crear-materia";

export interface EstadoCrearMateria {
  error?: string;
}

export async function crearMateriaAction(
  _estadoPrevio: EstadoCrearMateria,
  formData: FormData,
): Promise<EstadoCrearMateria> {
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    return { error: "El nombre de la materia es obligatorio." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await crearMateria(supabase, { nombre });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect("/materias");
}
