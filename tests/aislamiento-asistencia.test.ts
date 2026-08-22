// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3, módulo
// Asistencia. Mismo enfoque que tests/aislamiento-calificaciones.test.ts:
// SDK cliente contra el proyecto Supabase remoto de desarrollo, nunca SQL
// Editor ni `service_role`. Reusa el helper de cuentas de prueba fijas
// (tests/helpers/cuenta-prueba.ts) sin duplicarlo.
//
// Fecha fija y determinista (2026-01-15, en el pasado respecto a "hoy" del
// proyecto) para que la corrida sea idempotente: `registrarAsistenciaDelDia`
// usa upsert por `alumno_id,fecha`, así que volver a correr el test suite no
// duplica filas ni falla por unicidad.
//
// Este archivo no asume que otros archivos de test ya corrieron (cada
// archivo de Vitest corre en su propio proceso/worker): da de alta su propio
// alumno de prueba (misma matrícula fija TEST-A-001 que usan los otros
// suites) de forma idempotente si todavía no existe.
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerOCrearCuentaDePrueba, type CuentaDePrueba } from "./helpers/cuenta-prueba";
import { inscribirAlumno } from "@/modules/alumnos/casos-uso/inscribir-alumno";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";
import { registrarAsistenciaDelDia } from "@/modules/asistencia/casos-uso/registrar-asistencia-del-dia";

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const EMAIL_B = "test-aislamiento-b@controlescolar.test";
const PASSWORD = "TestAislamiento123!";
const MATRICULA_ALUMNO_A = "TEST-A-001";
const FECHA_A = "2026-01-15";

let cuentaA: CuentaDePrueba;
let cuentaB: CuentaDePrueba;
let alumnoIdA: string;

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

  // Idempotente: si ya existe (corrida anterior, u otro suite ya lo creó),
  // se trata como éxito — lo que importa es el estado final.
  const resultadoAlumno = await inscribirAlumno(cuentaA.supabase, {
    matricula: MATRICULA_ALUMNO_A,
    nombreCompleto: "Alumno de Prueba A",
  });
  if (!resultadoAlumno.exito) {
    expect(resultadoAlumno.error).toBe(
      "Ya existe un alumno con esa matrícula en este plantel.",
    );
  }

  const listaAlumnosA = await listarAlumnos(cuentaA.supabase);
  if (!listaAlumnosA.exito) {
    throw new Error(`No se pudo listar alumnos de A: ${listaAlumnosA.error}`);
  }
  const alumnoA = listaAlumnosA.alumnos.find(
    (a) => a.matricula === MATRICULA_ALUMNO_A,
  );
  if (!alumnoA) {
    throw new Error("No se encontró el alumno de prueba TEST-A-001.");
  }
  alumnoIdA = alumnoA.id;

  const resultadoAsistencia = await registrarAsistenciaDelDia(
    cuentaA.supabase,
    {
      fecha: FECHA_A,
      registros: [{ alumnoId: alumnoIdA, estado: "presente" }],
    },
  );
  if (!resultadoAsistencia.exito) {
    throw new Error(
      `No se pudo registrar la asistencia de prueba: ${resultadoAsistencia.error}`,
    );
  }
});

describe("aislamiento multi-tenant (RLS) — asistencias", () => {
  it("el usuario A puede ver el registro de asistencia que creó", async () => {
    const { data, error } = await cuentaA.supabase
      .from("asistencias")
      .select("*")
      .eq("alumno_id", alumnoIdA)
      .eq("fecha", FECHA_A);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el usuario B NO puede ver el registro de asistencia del alumno de A", async () => {
    const { data, error } = await cuentaB.supabase
      .from("asistencias")
      .select("*")
      .eq("alumno_id", alumnoIdA);

    // RLS filtra la fila en vez de devolver un error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario B no puede insertar un registro de asistencia con plantel_id/alumno_id del plantel de A (spoofing rechazado por RLS)", async () => {
    const { data, error } = await cuentaB.supabase
      .from("asistencias")
      .insert({
        plantel_id: cuentaA.perfil.plantel_id,
        alumno_id: alumnoIdA,
        fecha: "2026-01-16",
        estado: "presente",
      })
      .select();

    // La política `asistencias_insert_staff_mismo_plantel` exige
    // `plantel_id = plantel_id_actual()` en su WITH CHECK — el plantel_id
    // del insert es el de A, no el de B, así que Postgres rechaza la fila
    // con el código 42501 (política RLS violada).
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
