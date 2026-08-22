// Caso de uso: crear una invitación para que un correo se una al plantel del
// usuario actual con un rol determinado (administrativo/docente/alumno).
//
// Igual que `registrar-plantel-inicial`, `plantel_id`/`creada_por` se
// resuelven desde la sesión actual (vía `obtener-perfil-actual`), nunca de
// un valor de formulario — mismo criterio que el resto de módulos. El rol de
// staff (administrativo/oficina_central) requerido para crear invitaciones
// lo hace cumplir la política RLS `invitaciones_insert_staff_mismo_plantel`
// (ver supabase/migrations/20260822191914_invitaciones_plantel.sql); aquí
// solo se traduce el 42501 a un mensaje de negocio claro, mismo patrón que
// `publicar-aviso.ts`.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invitacion, RolInvitable } from "../dominio/invitacion";
import { obtenerPerfilActual } from "./obtener-perfil-actual";

const ROLES_INVITABLES: RolInvitable[] = ["administrativo", "docente", "alumno"];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DatosCrearInvitacion {
  email: string;
  rol: RolInvitable;
}

export type ResultadoCrearInvitacion =
  | { exito: true; invitacion: Invitacion }
  | { exito: false; error: string };

export async function crearInvitacion(
  supabase: SupabaseClient,
  datos: DatosCrearInvitacion,
): Promise<ResultadoCrearInvitacion> {
  const email = datos.email.trim().toLowerCase();

  if (!email || !REGEX_EMAIL.test(email)) {
    return { exito: false, error: "Ingresa un correo electrónico válido." };
  }

  if (!ROLES_INVITABLES.includes(datos.rol)) {
    return { exito: false, error: "Selecciona un rol válido." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { exito: false, error: "Debes iniciar sesión para invitar usuarios." };
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
    .from("invitaciones")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      email,
      rol: datos.rol,
      creada_por: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        exito: false,
        error: "No tienes permiso para invitar usuarios.",
      };
    }

    return { exito: false, error: error.message };
  }

  return { exito: true, invitacion: data as Invitacion };
}
