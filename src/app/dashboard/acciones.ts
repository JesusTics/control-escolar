"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "@/modules/identidad/casos-uso/cerrar-sesion";

export async function cerrarSesionAction() {
  const supabase = await crearClienteServidor();
  await cerrarSesion(supabase);
  redirect("/login");
}
