"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { inscribirAlumno } from "@/modules/alumnos/casos-uso/inscribir-alumno";

export interface EstadoInscripcionAlumno {
  error?: string;
}

export async function inscribirAlumnoAction(
  _estadoPrevio: EstadoInscripcionAlumno,
  formData: FormData,
): Promise<EstadoInscripcionAlumno> {
  const matricula = String(formData.get("matricula") ?? "").trim();
  const nombreCompleto = String(formData.get("nombreCompleto") ?? "").trim();
  const fechaNacimiento = String(formData.get("fechaNacimiento") ?? "").trim();

  if (!matricula || !nombreCompleto) {
    return { error: "La matrícula y el nombre son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const resultado = await inscribirAlumno(supabase, {
    matricula,
    nombreCompleto,
    fechaNacimiento: fechaNacimiento || undefined,
  });

  if (!resultado.exito) {
    return { error: resultado.error };
  }

  redirect("/alumnos");
}
