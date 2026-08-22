// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3.
//
// Corren contra el proyecto Supabase remoto de DESARROLLO real, con el SDK
// cliente (`@supabase/supabase-js`), tal como lo vería un usuario real —
// nunca contra el SQL Editor de Supabase (que corre como superusuario y
// bypasea RLS, dando falsa confianza) ni con `service_role`. Ver
// docs/adr/0001-validacion-arquitectura-inicial.md, adenda "Estrategia de
// testing de aislamiento RLS", para la justificación completa de este
// enfoque frente a la alternativa descartada (Supabase CLI + Docker local).
//
// Usa dos cuentas de prueba fijas y reutilizables (no efímeras) — ver
// tests/helpers/cuenta-prueba.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerOCrearCuentaDePrueba, type CuentaDePrueba } from "./helpers/cuenta-prueba";
import { inscribirAlumno } from "@/modules/alumnos/casos-uso/inscribir-alumno";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const EMAIL_B = "test-aislamiento-b@controlescolar.test";
const PASSWORD = "TestAislamiento123!";
const MATRICULA_ALUMNO_A = "TEST-A-001";

let cuentaA: CuentaDePrueba;
let cuentaB: CuentaDePrueba;

beforeAll(async () => {
  // En serie, no en paralelo: en una primera corrida ambas cuentas pueden
  // requerir signUp, y no vale la pena arriesgar condiciones de carrera en
  // Supabase Auth por paralelizar un setup que solo corre una vez por
  // proceso de test.
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
});

describe("aislamiento multi-tenant (RLS) — planteles y perfiles", () => {
  it("el usuario A ve su propio plantel y perfil", () => {
    expect(cuentaA.perfil.id).toBeTruthy();
    expect(cuentaA.perfil.plantel?.id).toBe(cuentaA.perfil.plantel_id);
  });

  it("el usuario B ve su propio plantel y perfil", () => {
    expect(cuentaB.perfil.id).toBeTruthy();
    expect(cuentaB.perfil.plantel?.id).toBe(cuentaB.perfil.plantel_id);
  });

  it("el usuario A no puede ver el plantel del usuario B", async () => {
    const { data, error } = await cuentaA.supabase
      .from("planteles")
      .select("*")
      .eq("id", cuentaB.perfil.plantel_id);

    // RLS filtra la fila en vez de devolver un error: el query es válido,
    // simplemente no hay filas visibles para este usuario.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario A no puede ver el perfil del usuario B", async () => {
    const { data, error } = await cuentaA.supabase
      .from("perfiles")
      .select("*")
      .eq("id", cuentaB.perfil.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("aislamiento multi-tenant (RLS) — alumnos", () => {
  it("el usuario A inscribe un alumno con matrícula fija", async () => {
    const resultado = await inscribirAlumno(cuentaA.supabase, {
      matricula: MATRICULA_ALUMNO_A,
      nombreCompleto: "Alumno de Prueba A",
    });

    // Matrícula determinista y fija a propósito (ver instrucciones de la
    // tarea): si ya existe de una corrida anterior, el caso de uso reporta
    // violación de unicidad (23505 traducido a mensaje de negocio) — se
    // trata como éxito esperado, no como fallo, porque lo que importa es el
    // estado final (el alumno existe en el plantel de A), no que el insert
    // sea nuevo en cada corrida.
    if (!resultado.exito) {
      expect(resultado.error).toBe(
        "Ya existe un alumno con esa matrícula en este plantel.",
      );
    } else {
      expect(resultado.alumno.matricula).toBe(MATRICULA_ALUMNO_A);
      expect(resultado.alumno.plantel_id).toBe(cuentaA.perfil.plantel_id);
    }
  });

  it("el usuario A puede ver ese alumno en su listado", async () => {
    const resultado = await listarAlumnos(cuentaA.supabase);

    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(
        resultado.alumnos.some((alumno) => alumno.matricula === MATRICULA_ALUMNO_A),
      ).toBe(true);
    }
  });

  it("el usuario B NO puede ver el alumno de A en su listado", async () => {
    const resultado = await listarAlumnos(cuentaB.supabase);

    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(
        resultado.alumnos.some((alumno) => alumno.matricula === MATRICULA_ALUMNO_A),
      ).toBe(false);
    }
  });

  it("el usuario B no puede insertar un alumno con plantel_id de A (spoofing rechazado por RLS)", async () => {
    const { data, error } = await cuentaB.supabase
      .from("alumnos")
      .insert({
        plantel_id: cuentaA.perfil.plantel_id,
        matricula: "TEST-SPOOF-001",
        nombre_completo: "Alumno Spoofeado",
      })
      .select();

    // La política `alumnos_insert_staff_mismo_plantel` exige
    // `plantel_id = plantel_id_actual()` en su WITH CHECK — B es staff de su
    // propio plantel, pero el plantel_id del insert es el de A, así que
    // Postgres rechaza la fila con el código 42501 (política RLS violada),
    // no un check de aplicación.
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
