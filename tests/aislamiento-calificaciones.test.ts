// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3, módulo
// Calificaciones. Mismo enfoque que tests/aislamiento-multitenant.test.ts:
// SDK cliente contra el proyecto Supabase remoto de desarrollo, nunca
// SQL Editor ni `service_role`. Reusa el helper de cuentas de prueba fijas
// (tests/helpers/cuenta-prueba.ts) sin duplicarlo.
//
// Reescrito para el modelo de Grupos (supabase/migrations/
// 20260823003328_grupos_e_inscripciones.sql,
// 20260823003332_calificaciones_por_grupo.sql): una calificación se
// registra por (alumno, grupo), y el grupo exige que el alumno esté inscrito
// (`public.inscripciones`) antes de poder recibir una calificación — mismo
// caso de aislamiento entre planteles que antes (A vs. B), migrado al nuevo
// esquema.
//
// Los archivos de test de Vitest corren en procesos/workers independientes,
// así que este archivo no asume que tests/aislamiento-multitenant.test.ts ya
// corrió: da de alta su propio alumno de prueba (misma matrícula fija
// TEST-A-001, idempotente — "ya existe" se trata como éxito, igual que en el
// suite existente) en vez de depender de un orden de ejecución entre
// archivos.
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerOCrearCuentaDePrueba, type CuentaDePrueba } from "./helpers/cuenta-prueba";
import { inscribirAlumno } from "@/modules/alumnos/casos-uso/inscribir-alumno";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";
import { crearMateria } from "@/modules/calificaciones/casos-uso/crear-materia";
import { listarMaterias } from "@/modules/calificaciones/casos-uso/listar-materias";
import { registrarCalificacion } from "@/modules/calificaciones/casos-uso/registrar-calificacion";
import { crearGrupo } from "@/modules/grupos/casos-uso/crear-grupo";
import { listarGruposPlantel } from "@/modules/grupos/casos-uso/listar-grupos-plantel";
import { inscribirAlumnoGrupo } from "@/modules/grupos/casos-uso/inscribir-alumno-grupo";

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const EMAIL_B = "test-aislamiento-b@controlescolar.test";
const PASSWORD = "TestAislamiento123!";
const MATRICULA_ALUMNO_A = "TEST-A-001";
const NOMBRE_MATERIA_A = "Matemáticas (prueba aislamiento)";
const PERIODO_A = "2026-1";
const NOMBRE_GRUPO_A = "Grupo A (prueba aislamiento)";

let cuentaA: CuentaDePrueba;
let cuentaB: CuentaDePrueba;
let alumnoIdA: string;
let materiaIdA: string;
let grupoIdA: string;

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

  // Idempotente: si ya existe (corrida anterior, o el otro suite ya lo
  // creó), se trata como éxito — lo que importa es el estado final.
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

  const resultadoMateria = await crearMateria(cuentaA.supabase, {
    nombre: NOMBRE_MATERIA_A,
  });
  if (!resultadoMateria.exito) {
    expect(resultadoMateria.error).toBe(
      "Ya existe una materia con ese nombre en este plantel.",
    );
  }

  const listaMateriasA = await listarMaterias(cuentaA.supabase);
  if (!listaMateriasA.exito) {
    throw new Error(`No se pudo listar materias de A: ${listaMateriasA.error}`);
  }
  const materiaA = listaMateriasA.materias.find(
    (m) => m.nombre === NOMBRE_MATERIA_A,
  );
  if (!materiaA) {
    throw new Error("No se encontró la materia de prueba.");
  }
  materiaIdA = materiaA.id;

  // Grupo de prueba (materia + nombre + periodo) e inscripción del alumno —
  // requisito de integridad nuevo: no se puede calificar a un alumno que no
  // está inscrito en el grupo.
  const resultadoGrupo = await crearGrupo(cuentaA.supabase, {
    materiaId: materiaIdA,
    nombre: NOMBRE_GRUPO_A,
    periodo: PERIODO_A,
  });
  if (!resultadoGrupo.exito) {
    expect(resultadoGrupo.error).toBe(
      "Ya existe un grupo con ese nombre para esa materia y periodo.",
    );
  }

  const listaGruposA = await listarGruposPlantel(cuentaA.supabase);
  if (!listaGruposA.exito) {
    throw new Error(`No se pudo listar grupos de A: ${listaGruposA.error}`);
  }
  const grupoA = listaGruposA.grupos.find(
    (g) => g.materia_id === materiaIdA && g.nombre === NOMBRE_GRUPO_A && g.periodo === PERIODO_A,
  );
  if (!grupoA) {
    throw new Error("No se encontró el grupo de prueba.");
  }
  grupoIdA = grupoA.id;

  const resultadoInscripcion = await inscribirAlumnoGrupo(cuentaA.supabase, {
    alumnoId: alumnoIdA,
    grupoId: grupoIdA,
  });
  if (!resultadoInscripcion.exito) {
    expect(resultadoInscripcion.error).toBe(
      "Este alumno ya está inscrito en este grupo.",
    );
  }

  const resultadoCalificacion = await registrarCalificacion(cuentaA.supabase, {
    alumnoId: alumnoIdA,
    grupoId: grupoIdA,
    calificacion: 8,
  });
  if (!resultadoCalificacion.exito) {
    throw new Error(
      `No se pudo registrar la calificación de prueba: ${resultadoCalificacion.error}`,
    );
  }
});

describe("aislamiento multi-tenant (RLS) — materias", () => {
  it("el usuario A ve la materia que creó", async () => {
    const resultado = await listarMaterias(cuentaA.supabase);

    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(
        resultado.materias.some((m) => m.nombre === NOMBRE_MATERIA_A),
      ).toBe(true);
    }
  });

  it("el usuario B NO puede ver la materia del plantel de A", async () => {
    const resultado = await listarMaterias(cuentaB.supabase);

    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(
        resultado.materias.some((m) => m.nombre === NOMBRE_MATERIA_A),
      ).toBe(false);
    }
  });
});

describe("aislamiento multi-tenant (RLS) — calificaciones", () => {
  it("el usuario A puede ver la calificación que registró", async () => {
    const { data, error } = await cuentaA.supabase
      .from("calificaciones")
      .select("*")
      .eq("alumno_id", alumnoIdA)
      .eq("grupo_id", grupoIdA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el usuario B NO puede ver la calificación del alumno de A", async () => {
    const { data, error } = await cuentaB.supabase
      .from("calificaciones")
      .select("*")
      .eq("alumno_id", alumnoIdA);

    // RLS filtra la fila en vez de devolver un error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el usuario B no puede insertar una calificación con plantel_id/alumno_id/grupo_id del plantel de A (spoofing rechazado por RLS)", async () => {
    const { data, error } = await cuentaB.supabase
      .from("calificaciones")
      .insert({
        plantel_id: cuentaA.perfil.plantel_id,
        alumno_id: alumnoIdA,
        grupo_id: grupoIdA,
        calificacion: 10,
      })
      .select();

    // La política `calificaciones_insert_staff_o_docente_grupo` exige
    // `plantel_id = plantel_id_actual()` en su WITH CHECK — el plantel_id
    // del insert es el de A, no el de B, así que Postgres rechaza la fila
    // con el código 42501 (política RLS violada).
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
