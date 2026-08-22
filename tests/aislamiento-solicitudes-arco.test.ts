// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3, canal de derechos
// ARCO del bounded context Identidad/Roles (LFPDPPP, CLAUDE.md 4.4). Mismo
// enfoque que tests/aislamiento-avisos.test.ts: SDK cliente contra el
// proyecto Supabase remoto de desarrollo, nunca SQL Editor ni `service_role`.
// Reusa el helper de cuentas de prueba fijas (tests/helpers/cuenta-prueba.ts).
//
// La cuenta A (dada de alta con `registrarPlantelInicial`, ver
// `obtenerOCrearCuentaDePrueba`) queda con rol `oficina_central` — staff de
// su propio plantel —, así que sirve tanto para crear la solicitud como
// solicitante, como para resolverla como staff, sin necesitar una tercera
// cuenta dedicada.
//
// Descripción fija y determinista para que la corrida sea idempotente entre
// ejecuciones (no hay upsert aquí — solo alta —, así que se filtra por esa
// descripción fija en vez de asumir una única solicitud en la tabla).
//
// Este archivo no asume que otros archivos de test ya corrieron (cada
// archivo de Vitest corre en su propio proceso/worker): crea su propia
// solicitud de prueba si todavía no existe.
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerOCrearCuentaDePrueba, type CuentaDePrueba } from "./helpers/cuenta-prueba";
import { crearSolicitudArco } from "@/modules/identidad/casos-uso/crear-solicitud-arco";
import { resolverSolicitudArco } from "@/modules/identidad/casos-uso/resolver-solicitud-arco";

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const EMAIL_B = "test-aislamiento-b@controlescolar.test";
const PASSWORD = "TestAislamiento123!";
const DESCRIPCION_SOLICITUD_A =
  "Solicitud de prueba de aislamiento — quiero saber qué datos tienen de mí.";

let cuentaA: CuentaDePrueba;
let cuentaB: CuentaDePrueba;
let solicitudIdA: string;

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

  // Idempotente: si la solicitud de prueba ya existe (corrida anterior), se
  // reusa en vez de duplicarla — no hay restricción `unique` en
  // `solicitudes_arco`, así que se busca por descripción fija antes de
  // insertar de nuevo.
  const { data: existentes, error: errorExistentes } = await cuentaA.supabase
    .from("solicitudes_arco")
    .select("id")
    .eq("descripcion", DESCRIPCION_SOLICITUD_A)
    .limit(1);

  if (errorExistentes) {
    throw new Error(
      `No se pudo verificar si ya existe la solicitud de prueba: ${errorExistentes.message}`,
    );
  }

  if (existentes && existentes.length > 0) {
    solicitudIdA = existentes[0].id;
    return;
  }

  const resultadoSolicitud = await crearSolicitudArco(cuentaA.supabase, {
    tipo: "acceso",
    descripcion: DESCRIPCION_SOLICITUD_A,
  });

  if (!resultadoSolicitud.exito) {
    throw new Error(
      `No se pudo crear la solicitud ARCO de prueba: ${resultadoSolicitud.error}`,
    );
  }

  solicitudIdA = resultadoSolicitud.solicitud.id;
});

describe("aislamiento multi-tenant (RLS) — solicitudes ARCO", () => {
  it("el usuario A puede ver la solicitud que creó", async () => {
    const { data, error } = await cuentaA.supabase
      .from("solicitudes_arco")
      .select("*")
      .eq("id", solicitudIdA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el usuario B NO puede ver la solicitud creada por A", async () => {
    const { data, error } = await cuentaB.supabase
      .from("solicitudes_arco")
      .select("*")
      .eq("id", solicitudIdA);

    // RLS filtra la fila en vez de devolver un error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario B no puede resolver (UPDATE) la solicitud creada por A", async () => {
    const { data, error } = await cuentaB.supabase
      .from("solicitudes_arco")
      .update({ estado: "resuelta", respuesta: "Intento no autorizado" })
      .eq("id", solicitudIdA)
      .select();

    // La política `solicitudes_arco_update_staff` exige que B tenga rol de
    // staff del MISMO plantel que la solicitud (el de A) — B no lo es, así
    // que su USING clause no encuentra la fila: el UPDATE no afecta ninguna
    // fila (sin error, resultado vacío), en vez de lanzar 42501 (eso ocurre
    // con WITH CHECK en INSERT, no aquí).
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario B no puede insertar una solicitud con plantel_id del plantel de A (spoofing rechazado por RLS)", async () => {
    const { data, error } = await cuentaB.supabase
      .from("solicitudes_arco")
      .insert({
        plantel_id: cuentaA.perfil.plantel_id,
        solicitante_id: cuentaB.perfil.id,
        tipo: "acceso",
        descripcion: "Solicitud spoofing",
      })
      .select();

    // La política `solicitudes_arco_insert_propia` exige
    // `plantel_id = plantel_id_actual()` en su WITH CHECK — el plantel_id
    // del insert es el de A, no el de B, así que Postgres rechaza la fila
    // con el código 42501 (política RLS violada).
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("flujo funcional — staff resuelve solicitudes de su propio plantel", () => {
  it("el staff (cuenta A, rol oficina_central) puede ver y resolver la solicitud de su propio plantel", async () => {
    const resultadoResolver = await resolverSolicitudArco(cuentaA.supabase, {
      solicitudId: solicitudIdA,
      respuesta: "Se revisaron los datos capturados, todo correcto.",
    });

    expect(resultadoResolver.exito).toBe(true);
    if (!resultadoResolver.exito) return;

    expect(resultadoResolver.solicitud.estado).toBe("resuelta");
    expect(resultadoResolver.solicitud.respuesta).toBe(
      "Se revisaron los datos capturados, todo correcto.",
    );
  });
});
