// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3, módulo
// Comunicación. Mismo enfoque que tests/aislamiento-asistencia.test.ts: SDK
// cliente contra el proyecto Supabase remoto de desarrollo, nunca SQL Editor
// ni `service_role`. Reusa el helper de cuentas de prueba fijas
// (tests/helpers/cuenta-prueba.ts) sin duplicarlo.
//
// Título/contenido fijos y deterministas para que la corrida sea idempotente
// entre ejecuciones (no hay upsert aquí — solo alta —, así que se filtra por
// ese título fijo en vez de asumir un único aviso en la tabla).
//
// Este archivo no asume que otros archivos de test ya corrieron (cada
// archivo de Vitest corre en su propio proceso/worker): publica su propio
// aviso de prueba si todavía no existe.
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerOCrearCuentaDePrueba, type CuentaDePrueba } from "./helpers/cuenta-prueba";
import { publicarAviso } from "@/modules/comunicacion/casos-uso/publicar-aviso";

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const EMAIL_B = "test-aislamiento-b@controlescolar.test";
const PASSWORD = "TestAislamiento123!";
const TITULO_AVISO_A = "Aviso de prueba de aislamiento A";
const CONTENIDO_AVISO_A = "Contenido fijo y determinista para el test de aislamiento.";

let cuentaA: CuentaDePrueba;
let cuentaB: CuentaDePrueba;
let avisoIdA: string;

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

  // Idempotente: si el aviso de prueba ya existe (corrida anterior), se
  // reusa en vez de duplicarlo — no hay una restricción `unique` en `avisos`
  // (a diferencia de alumnos/materias), así que se busca por título antes de
  // insertar de nuevo.
  const { data: existentes, error: errorExistentes } = await cuentaA.supabase
    .from("avisos")
    .select("id")
    .eq("titulo", TITULO_AVISO_A)
    .limit(1);

  if (errorExistentes) {
    throw new Error(
      `No se pudo verificar si ya existe el aviso de prueba: ${errorExistentes.message}`,
    );
  }

  if (existentes && existentes.length > 0) {
    avisoIdA = existentes[0].id;
    return;
  }

  const resultadoAviso = await publicarAviso(cuentaA.supabase, {
    titulo: TITULO_AVISO_A,
    contenido: CONTENIDO_AVISO_A,
  });

  if (!resultadoAviso.exito) {
    throw new Error(
      `No se pudo publicar el aviso de prueba: ${resultadoAviso.error}`,
    );
  }

  avisoIdA = resultadoAviso.aviso.id;
});

describe("aislamiento multi-tenant (RLS) — avisos", () => {
  it("el usuario A puede ver el aviso que publicó", async () => {
    const { data, error } = await cuentaA.supabase
      .from("avisos")
      .select("*")
      .eq("id", avisoIdA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el usuario B NO puede ver el aviso publicado por A", async () => {
    const { data, error } = await cuentaB.supabase
      .from("avisos")
      .select("*")
      .eq("id", avisoIdA);

    // RLS filtra la fila en vez de devolver un error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario B no puede insertar un aviso con plantel_id del plantel de A (spoofing rechazado por RLS)", async () => {
    const { data, error } = await cuentaB.supabase
      .from("avisos")
      .insert({
        plantel_id: cuentaA.perfil.plantel_id,
        autor_id: cuentaB.perfil.id,
        titulo: "Aviso spoofing",
        contenido: "No debería poder insertarse.",
      })
      .select();

    // La política `avisos_insert_staff_mismo_plantel` exige
    // `plantel_id = plantel_id_actual()` en su WITH CHECK — el plantel_id
    // del insert es el de A, no el de B, así que Postgres rechaza la fila
    // con el código 42501 (política RLS violada).
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
