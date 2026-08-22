// Tests de aislamiento multi-tenant (RLS) y del flujo funcional completo de
// aceptación del módulo de invitaciones — CLAUDE.md 4.3. Mismo enfoque que
// tests/aislamiento-avisos.test.ts: SDK cliente contra el proyecto Supabase
// remoto de desarrollo, nunca SQL Editor ni `service_role`. Reusa el helper
// de cuentas de prueba fijas (tests/helpers/cuenta-prueba.ts).
//
// Este archivo no asume que otros archivos de test ya corrieron (cada
// archivo de Vitest corre en su propio proceso/worker): crea su propia
// invitación de prueba de forma idempotente si todavía no existe.
//
// La parte de mayor riesgo de este módulo (ver diseño de la sesión) no es el
// aislamiento por sí solo — es cruzar de "sin perfil" a "con perfil y
// plantel correcto" al aceptar una invitación, así que se cubre con un test
// funcional dedicado además de los tres casos estándar de aislamiento.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  obtenerOCrearCuentaDePrueba,
  obtenerPerfilConReintento,
  type CuentaDePrueba,
} from "./helpers/cuenta-prueba";
import { crearInvitacion } from "@/modules/identidad/casos-uso/crear-invitacion";
import { aceptarInvitacion } from "@/modules/identidad/casos-uso/aceptar-invitacion";
import type { RolInvitable } from "@/modules/identidad/dominio/invitacion";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const EMAIL_B = "test-aislamiento-b@controlescolar.test";
const PASSWORD = "TestAislamiento123!";

// Tercer correo de prueba fijo y determinista, distinto de A/B — es quien
// acepta la invitación en el test funcional. Mismo estilo que las cuentas de
// `cuenta-prueba.ts`.
const EMAIL_INVITADO = "test-invitado@controlescolar.test";
const PASSWORD_INVITADO = "TestInvitado123!";
const NOMBRE_INVITADO = "Usuario Invitado de Prueba";
const ROL_INVITADO: RolInvitable = "docente";

let cuentaA: CuentaDePrueba;
let cuentaB: CuentaDePrueba;
let invitacionIdA: string;
let tokenInvitacionA: string;

beforeAll(async () => {
  cuentaA = await obtenerOCrearCuentaDePrueba(
    EMAIL_A,
    PASSWORD,
    "Plantel de Prueba A (aislamiento multi-tenant)",
    "Usuario de Prueba A",
  );
  cuentaB = await obtenerOCrearCuentaDePrueba(
    EMAIL_B,
    PASSWORD,
    "Plantel de Prueba B (aislamiento multi-tenant)",
    "Usuario de Prueba B",
  );

  // Idempotente: si la invitación de prueba ya existe (corrida anterior), se
  // reusa en vez de duplicarla — no hay una restricción `unique(plantel_id,
  // email)` en `invitaciones` (una misma persona podría, en teoría, ser
  // invitada más de una vez), así que se busca por email fijo antes de
  // insertar de nuevo.
  const { data: existentes, error: errorExistentes } = await cuentaA.supabase
    .from("invitaciones")
    .select("id, token")
    .eq("plantel_id", cuentaA.perfil.plantel_id)
    .eq("email", EMAIL_INVITADO)
    .limit(1);

  if (errorExistentes) {
    throw new Error(
      `No se pudo verificar si ya existe la invitación de prueba: ${errorExistentes.message}`,
    );
  }

  if (existentes && existentes.length > 0) {
    invitacionIdA = existentes[0].id;
    tokenInvitacionA = existentes[0].token;
    return;
  }

  const resultadoInvitacion = await crearInvitacion(cuentaA.supabase, {
    email: EMAIL_INVITADO,
    rol: ROL_INVITADO,
  });

  if (!resultadoInvitacion.exito) {
    throw new Error(
      `No se pudo crear la invitación de prueba: ${resultadoInvitacion.error}`,
    );
  }

  invitacionIdA = resultadoInvitacion.invitacion.id;
  tokenInvitacionA = resultadoInvitacion.invitacion.token;
});

describe("aislamiento multi-tenant (RLS) — invitaciones", () => {
  it("el usuario A puede ver la invitación que creó", async () => {
    const { data, error } = await cuentaA.supabase
      .from("invitaciones")
      .select("*")
      .eq("id", invitacionIdA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el usuario B NO puede ver la invitación creada por A", async () => {
    const { data, error } = await cuentaB.supabase
      .from("invitaciones")
      .select("*")
      .eq("id", invitacionIdA);

    // RLS filtra la fila en vez de devolver un error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario B no puede insertar una invitación con plantel_id del plantel de A (spoofing rechazado por RLS)", async () => {
    const { data, error } = await cuentaB.supabase
      .from("invitaciones")
      .insert({
        plantel_id: cuentaA.perfil.plantel_id,
        email: "spoofing@controlescolar.test",
        rol: "docente",
        creada_por: cuentaB.perfil.id,
      })
      .select();

    // La política `invitaciones_insert_staff_mismo_plantel` exige
    // `plantel_id = plantel_id_actual()` en su WITH CHECK — el plantel_id
    // del insert es el de A, no el de B, así que Postgres rechaza la fila
    // con el código 42501 (política RLS violada).
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("flujo funcional — aceptar invitación", () => {
  it("el usuario invitado acepta la invitación y queda con el plantel_id y rol correctos", async () => {
    // Cliente independiente, sin persistir sesión — se comporta como un
    // navegador nuevo del usuario invitado, nunca comparte estado con
    // cuentaA/cuentaB (mismo criterio que obtenerOCrearCuentaDePrueba).
    const supabaseInvitado = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const inicioSesion = await supabaseInvitado.auth.signInWithPassword({
      email: EMAIL_INVITADO,
      password: PASSWORD_INVITADO,
    });

    if (inicioSesion.error) {
      // Primera corrida: la cuenta de Auth todavía no existe.
      // `aceptarInvitacion` hace el `signUp` internamente porque no hay
      // sesión activa en este cliente nuevo.
      const resultadoAceptar = await aceptarInvitacion(supabaseInvitado, {
        token: tokenInvitacionA,
        email: EMAIL_INVITADO,
        password: PASSWORD_INVITADO,
        nombreCompleto: NOMBRE_INVITADO,
      });

      if (!resultadoAceptar.exito) {
        throw new Error(
          `No se pudo aceptar la invitación de prueba: ${resultadoAceptar.error}`,
        );
      }
    } else {
      // Corrida posterior: la cuenta de Auth ya existe. Si el perfil también
      // ya existe (invitación aceptada en una corrida anterior), se trata
      // como éxito esperado — no se vuelve a llamar el RPC, que fallaría con
      // "El usuario ya tiene un perfil" (es de un solo uso por diseño,
      // mismo criterio que `crear_plantel_y_perfil_inicial`).
      const perfilExistente = await obtenerPerfilConReintento(supabaseInvitado);

      if (!perfilExistente.exito) {
        throw new Error(
          `No se pudo leer el perfil de la cuenta invitada: ${perfilExistente.error}`,
        );
      }

      if (!perfilExistente.perfil) {
        const resultadoAceptar = await aceptarInvitacion(supabaseInvitado, {
          token: tokenInvitacionA,
          email: EMAIL_INVITADO,
          password: PASSWORD_INVITADO,
          nombreCompleto: NOMBRE_INVITADO,
        });

        if (!resultadoAceptar.exito) {
          throw new Error(
            `No se pudo aceptar la invitación de prueba: ${resultadoAceptar.error}`,
          );
        }
      }
    }

    const perfilFinal = await obtenerPerfilConReintento(supabaseInvitado);

    if (!perfilFinal.exito || !perfilFinal.perfil) {
      throw new Error(
        "No se pudo releer el perfil del usuario invitado tras aceptar la invitación.",
      );
    }

    // (a) el plantel_id es el mismo de A, no uno nuevo.
    expect(perfilFinal.perfil.plantel_id).toBe(cuentaA.perfil.plantel_id);
    // (b) el rol es el asignado en la invitación, no el del alta inicial
    //     (`oficina_central`).
    expect(perfilFinal.perfil.rol).toBe(ROL_INVITADO);
  });
});
