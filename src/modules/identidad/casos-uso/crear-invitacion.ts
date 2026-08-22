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
//
// `alumnoId` (opcional, solo relevante cuando `rol === 'alumno'`): vincula la
// invitación a una fila existente de `alumnos` sin cuenta todavía
// (`perfil_id is null`) — `aceptar_invitacion` (ver
// supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql) usa ese
// vínculo para asignar `alumnos.perfil_id` cuando la invitación se acepta.
// Es opcional a propósito: si el plantel todavía no tiene alumnos sin
// vincular, sigue siendo válido invitar a un `alumno` sin seleccionar uno —
// el portal de esa cuenta simplemente informará que falta vincularla (ver
// `/dashboard`), en vez de bloquear la creación de la invitación.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invitacion, RolInvitable } from "../dominio/invitacion";
import { obtenerPerfilActual } from "./obtener-perfil-actual";

const ROLES_INVITABLES: RolInvitable[] = ["administrativo", "docente", "alumno"];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DatosCrearInvitacion {
  email: string;
  rol: RolInvitable;
  alumnoId?: string;
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

  let alumnoId: string | null = null;

  if (datos.rol === "alumno" && datos.alumnoId) {
    const { data: alumno, error: errorAlumno } = await supabase
      .from("alumnos")
      .select("id, perfil_id")
      .eq("id", datos.alumnoId)
      .eq("plantel_id", resultadoPerfil.perfil.plantel_id)
      .maybeSingle();

    if (errorAlumno) {
      return { exito: false, error: errorAlumno.message };
    }

    if (!alumno) {
      return {
        exito: false,
        error: "El alumno seleccionado no existe en tu plantel.",
      };
    }

    if (alumno.perfil_id) {
      return {
        exito: false,
        error: "El alumno seleccionado ya tiene una cuenta vinculada.",
      };
    }

    alumnoId = alumno.id;
  }

  const { data, error } = await supabase
    .from("invitaciones")
    .insert({
      plantel_id: resultadoPerfil.perfil.plantel_id,
      email,
      rol: datos.rol,
      creada_por: user.id,
      alumno_id: alumnoId,
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
