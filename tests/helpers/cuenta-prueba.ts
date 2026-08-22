// Helper para los tests de aislamiento multi-tenant (RLS): obtiene, o crea
// si es la primera corrida, una cuenta de prueba fija junto con su plantel y
// perfil.
//
// Decisión de diseño (ver docs/adr/0001-validacion-arquitectura-inicial.md,
// adenda "Estrategia de testing de aislamiento RLS"): las cuentas de prueba
// son fijas y reutilizables entre corridas, no efímeras, para no necesitar
// `service_role` (prohibido en el flujo normal de request, CLAUDE.md 4.3) ni
// un paso de limpieza automática. Sus datos viven permanentemente en el
// proyecto Supabase de DESARROLLO — nunca en producción.
//
// Reusa los mismos casos de uso que la app (`registrarPlantelInicial`,
// `obtenerPerfilActual`) en vez de hacer INSERTs directos, para que el test
// ejercite el mismo camino que un usuario real y no un atajo que podría
// esconder una regresión en el caso de uso.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { registrarPlantelInicial } from "@/modules/identidad/casos-uso/registrar-plantel-inicial";
import {
  obtenerPerfilActual,
  type ResultadoPerfilActual,
} from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import type { PerfilConPlantel } from "@/modules/identidad/dominio/perfil";

/**
 * `obtenerPerfilActual` justo después de iniciar sesión puede fallar de forma
 * intermitente con "JWT issued at future" — un desfase de reloj transitorio
 * entre los servicios internos de Supabase (Auth vs. PostgREST), observado
 * tanto en local como en CI, que se autorresuelve en segundos. No es un error
 * de nuestro código, así que reintentamos solo esta clase de error puntual en
 * vez de dejar fallar el test entero por un hipo de infraestructura ajena.
 */
export async function obtenerPerfilConReintento(
  supabase: SupabaseClient,
  intentos = 3,
): Promise<ResultadoPerfilActual> {
  let resultado: ResultadoPerfilActual;
  for (let intento = 0; intento < intentos; intento++) {
    resultado = await obtenerPerfilActual(supabase);
    if (resultado.exito || !resultado.error.includes("JWT issued at future")) {
      return resultado;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (intento + 1)));
  }
  return resultado!;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local " +
      "para correr los tests de aislamiento multi-tenant.",
  );
}

export interface CuentaDePrueba {
  supabase: SupabaseClient;
  perfil: PerfilConPlantel;
}

/**
 * Inicia sesión con una cuenta de prueba fija; si no existe todavía (primera
 * corrida en este proyecto de Supabase), la crea con `signUp` y da de alta
 * su plantel/perfil con el mismo RPC que usa `registrar-plantel-inicial.ts`.
 * Idempotente: correr el test suite muchas veces reutiliza la misma cuenta,
 * plantel y perfil sin duplicar ni fallar.
 *
 * Cada llamada crea un cliente de Supabase nuevo e independiente (sesión
 * propia, sin persistencia entre procesos) para que dos cuentas de prueba en
 * el mismo test suite se comporten como dos usuarios reales en dos sesiones
 * de navegador distintas, nunca compartiendo estado.
 */
export async function obtenerOCrearCuentaDePrueba(
  email: string,
  password: string,
  nombrePlantel: string,
  nombreCompleto: string,
): Promise<CuentaDePrueba> {
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const inicioSesion = await supabase.auth.signInWithPassword({ email, password });

  if (inicioSesion.error) {
    const registro = await supabase.auth.signUp({ email, password });

    if (registro.error) {
      throw new Error(
        `No se pudo crear la cuenta de prueba ${email}: ${registro.error.message}`,
      );
    }

    if (!registro.data.session) {
      // Caso borde documentado en ARCHITECTURE.md (sección Identidad/Roles):
      // si el proyecto de Supabase tuviera confirmación de correo activada,
      // `signUp` no dejaría sesión activa y el RPC de alta (que requiere
      // `auth.uid()`) no se podría llamar aquí. El proyecto de desarrollo
      // actual no la tiene activada, así que esto se trata como un error de
      // configuración inesperado en vez de intentar un flujo alterno.
      throw new Error(
        `La cuenta de prueba ${email} se creó pero sin sesión activa (¿confirmación ` +
          "de correo activada en el proyecto de Supabase de desarrollo?). Estos tests " +
          "requieren sesión inmediata tras signUp.",
      );
    }
  }

  const perfilExistente = await obtenerPerfilConReintento(supabase);

  if (!perfilExistente.exito) {
    throw new Error(
      `No se pudo leer el perfil de la cuenta de prueba ${email}: ${perfilExistente.error}`,
    );
  }

  if (perfilExistente.perfil) {
    return { supabase, perfil: perfilExistente.perfil };
  }

  // Cuenta existente en Auth pero todavía sin plantel/perfil (primera
  // corrida, o una corrida anterior que falló justo después del signUp) —
  // se completa el alta con el mismo caso de uso que usa la app.
  const alta = await registrarPlantelInicial(supabase, {
    nombrePlantel,
    nombreCompleto,
  });

  if (!alta.exito) {
    throw new Error(
      `No se pudo dar de alta plantel/perfil para ${email}: ${alta.error}`,
    );
  }

  const perfilFinal = await obtenerPerfilConReintento(supabase);

  if (!perfilFinal.exito || !perfilFinal.perfil) {
    throw new Error(
      `Plantel/perfil creados para ${email} pero no se pudieron releer con el plantel incluido.`,
    );
  }

  return { supabase, perfil: perfilFinal.perfil };
}
