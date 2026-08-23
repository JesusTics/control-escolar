// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3, asignación
// docente<->materia (`public.docente_materias`,
// supabase/migrations/20260823000049_asignacion_docente_materia.sql).
// Mismo enfoque que el resto del suite: SDK cliente contra el proyecto
// Supabase remoto de desarrollo (nunca SQL Editor ni `service_role`).
//
// Cubre el hueco de mínimo privilegio cerrado en esta sesión: hasta ahora
// cualquier perfil con rol `docente` podía ver y calificar CUALQUIER materia
// de su plantel — un docente de Matemáticas podía calificar Historia sin
// restricción. Verifica:
// 1. Un docente SIN asignación a una materia no puede ver ni insertar
//    calificaciones de esa materia (RLS lo rechaza).
// 2. Un docente CON asignación sí puede ver e insertar calificaciones de esa
//    materia específica, pero sigue sin poder hacerlo en una materia
//    distinta no asignada.
// 3. Staff (`oficina_central`) sigue viendo/calificando todas las materias
//    sin restricción — sin cambio de comportamiento.
//
// Cuenta de docente propia de este archivo (email distinto de
// tests/aislamiento-invitaciones.test.ts) para no competir por la misma
// invitación/cuenta con otro archivo que corre en un worker independiente
// (cada archivo de Vitest corre en su propio proceso, ver ARCHITECTURE.md
// "Decisiones técnicas — Testing de aislamiento multi-tenant").
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  obtenerOCrearCuentaDePrueba,
  obtenerPerfilConReintento,
  type CuentaDePrueba,
} from "./helpers/cuenta-prueba";
import { inscribirAlumno } from "@/modules/alumnos/casos-uso/inscribir-alumno";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";
import { crearMateria } from "@/modules/calificaciones/casos-uso/crear-materia";
import { listarMaterias } from "@/modules/calificaciones/casos-uso/listar-materias";
import { registrarCalificacion } from "@/modules/calificaciones/casos-uso/registrar-calificacion";
import { asignarDocenteMateria } from "@/modules/calificaciones/casos-uso/asignar-docente-materia";
import { crearInvitacion } from "@/modules/identidad/casos-uso/crear-invitacion";
import { aceptarInvitacion } from "@/modules/identidad/casos-uso/aceptar-invitacion";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const PASSWORD = "TestAislamiento123!";

// Matrícula/nombres de materia propios de este archivo (distintos de
// TEST-A-001 y de los demás suites) para no interferir con sus datos ni
// depender de un orden de ejecución entre archivos.
const MATRICULA_ALUMNO = "TEST-A-DOCENTE-MATERIAS";
const NOMBRE_MATERIA_ASIGNADA = "Matemáticas (prueba asignación docente)";
const NOMBRE_MATERIA_NO_ASIGNADA = "Historia (prueba asignación docente)";
const PERIODO = "2026-1";

const EMAIL_DOCENTE = "test-docente-materias@controlescolar.test";
const PASSWORD_DOCENTE = "TestDocenteMaterias123!";
const NOMBRE_DOCENTE = "Cuenta de Prueba Docente con Asignación";

let cuentaA: CuentaDePrueba;
let alumnoId: string;
let materiaAsignadaId: string;
let materiaNoAsignadaId: string;
let supabaseDocente: SupabaseClient;
let docentePerfilId: string;

beforeAll(async () => {
  cuentaA = await obtenerOCrearCuentaDePrueba(
    EMAIL_A,
    PASSWORD,
    "Plantel de Prueba A (aislamiento multi-tenant)",
    "Usuario de Prueba A",
  );

  // Alumno de prueba, idempotente entre corridas.
  const resultadoAlumno = await inscribirAlumno(cuentaA.supabase, {
    matricula: MATRICULA_ALUMNO,
    nombreCompleto: "Alumno de Prueba (asignación docente)",
  });
  if (!resultadoAlumno.exito) {
    expect(resultadoAlumno.error).toBe(
      "Ya existe un alumno con esa matrícula en este plantel.",
    );
  }

  const listaAlumnos = await listarAlumnos(cuentaA.supabase);
  if (!listaAlumnos.exito) {
    throw new Error(`No se pudo listar alumnos de A: ${listaAlumnos.error}`);
  }
  const alumno = listaAlumnos.alumnos.find(
    (a) => a.matricula === MATRICULA_ALUMNO,
  );
  if (!alumno) {
    throw new Error("No se encontró el alumno de prueba.");
  }
  alumnoId = alumno.id;

  // Dos materias: una se asignará al docente de prueba, la otra no.
  for (const nombre of [NOMBRE_MATERIA_ASIGNADA, NOMBRE_MATERIA_NO_ASIGNADA]) {
    const resultadoMateria = await crearMateria(cuentaA.supabase, { nombre });
    if (!resultadoMateria.exito) {
      expect(resultadoMateria.error).toBe(
        "Ya existe una materia con ese nombre en este plantel.",
      );
    }
  }

  const listaMaterias = await listarMaterias(cuentaA.supabase);
  if (!listaMaterias.exito) {
    throw new Error(`No se pudo listar materias de A: ${listaMaterias.error}`);
  }
  const materiaAsignada = listaMaterias.materias.find(
    (m) => m.nombre === NOMBRE_MATERIA_ASIGNADA,
  );
  const materiaNoAsignada = listaMaterias.materias.find(
    (m) => m.nombre === NOMBRE_MATERIA_NO_ASIGNADA,
  );
  if (!materiaAsignada || !materiaNoAsignada) {
    throw new Error("No se encontraron las materias de prueba.");
  }
  materiaAsignadaId = materiaAsignada.id;
  materiaNoAsignadaId = materiaNoAsignada.id;

  // Calificación de staff en la materia NO asignada, para verificar que el
  // docente sin asignación de verdad no la ve (si no existiera ninguna fila,
  // "no ver nada" sería un falso positivo).
  const registroNoAsignada = await registrarCalificacion(cuentaA.supabase, {
    alumnoId,
    materiaId: materiaNoAsignadaId,
    periodo: PERIODO,
    calificacion: 8,
  });
  if (!registroNoAsignada.exito) {
    throw new Error(
      `No se pudo registrar la calificación de control: ${registroNoAsignada.error}`,
    );
  }

  // Cuenta con rol docente, propia de este archivo — dada de alta vía
  // invitación (mismo patrón que tests/aislamiento-alumnos.test.ts con el
  // alumno X).
  supabaseDocente = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const inicioSesion = await supabaseDocente.auth.signInWithPassword({
    email: EMAIL_DOCENTE,
    password: PASSWORD_DOCENTE,
  });

  let perfilYaExiste = false;
  if (!inicioSesion.error) {
    const perfilExistente = await obtenerPerfilConReintento(supabaseDocente);
    if (!perfilExistente.exito) {
      throw new Error(
        `No se pudo leer el perfil de la cuenta docente: ${perfilExistente.error}`,
      );
    }
    perfilYaExiste = !!perfilExistente.perfil;
  }

  if (!perfilYaExiste) {
    const resultadoInvitacion = await crearInvitacion(cuentaA.supabase, {
      email: EMAIL_DOCENTE,
      rol: "docente",
    });
    if (!resultadoInvitacion.exito) {
      throw new Error(
        `No se pudo crear la invitación de la cuenta docente: ${resultadoInvitacion.error}`,
      );
    }

    const resultadoAceptar = await aceptarInvitacion(supabaseDocente, {
      token: resultadoInvitacion.invitacion.token,
      email: EMAIL_DOCENTE,
      password: PASSWORD_DOCENTE,
      nombreCompleto: NOMBRE_DOCENTE,
    });
    if (!resultadoAceptar.exito) {
      throw new Error(
        `No se pudo aceptar la invitación de la cuenta docente: ${resultadoAceptar.error}`,
      );
    }
  }

  const perfilDocente = await obtenerPerfilConReintento(supabaseDocente);
  if (!perfilDocente.exito || !perfilDocente.perfil) {
    throw new Error(
      "No se pudo resolver el perfil de la cuenta docente de prueba.",
    );
  }
  docentePerfilId = perfilDocente.perfil.id;
});

describe("docente SIN asignación no puede ver ni insertar calificaciones", () => {
  it("no ve la calificación de la materia no asignada (RLS filtra la fila)", async () => {
    const { data, error } = await supabaseDocente
      .from("calificaciones")
      .select("*")
      .eq("materia_id", materiaNoAsignadaId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("no puede insertar una calificación en la materia no asignada (RLS rechaza)", async () => {
    const resultado = await registrarCalificacion(supabaseDocente, {
      alumnoId,
      materiaId: materiaNoAsignadaId,
      periodo: "TEST-SIN-ASIGNAR",
      calificacion: 10,
    });

    expect(resultado.exito).toBe(false);
    if (!resultado.exito) {
      expect(resultado.error).toContain("No tienes esta materia asignada");
    }
  });
});

describe("docente CON asignación ve/inserta solo en su materia asignada", () => {
  beforeAll(async () => {
    // Idempotente: si la asignación ya existe de una corrida anterior, se
    // trata como éxito (mismo criterio que crearMateria/inscribirAlumno en
    // este suite).
    const resultado = await asignarDocenteMateria(cuentaA.supabase, {
      docenteId: docentePerfilId,
      materiaId: materiaAsignadaId,
    });
    if (!resultado.exito) {
      expect(resultado.error).toBe("Ese docente ya tiene asignada esta materia.");
    }
  });

  it("puede insertar una calificación en la materia asignada", async () => {
    const resultado = await registrarCalificacion(supabaseDocente, {
      alumnoId,
      materiaId: materiaAsignadaId,
      periodo: PERIODO,
      calificacion: 9,
    });

    expect(resultado.exito).toBe(true);
  });

  it("ve la calificación que acaba de registrar en la materia asignada", async () => {
    const { data, error } = await supabaseDocente
      .from("calificaciones")
      .select("*")
      .eq("materia_id", materiaAsignadaId)
      .eq("alumno_id", alumnoId)
      .eq("periodo", PERIODO);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("sigue sin poder ver la calificación de la materia NO asignada", async () => {
    const { data, error } = await supabaseDocente
      .from("calificaciones")
      .select("*")
      .eq("materia_id", materiaNoAsignadaId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("sigue sin poder insertar en la materia NO asignada", async () => {
    const resultado = await registrarCalificacion(supabaseDocente, {
      alumnoId,
      materiaId: materiaNoAsignadaId,
      periodo: "TEST-SIN-ASIGNAR-2",
      calificacion: 10,
    });

    expect(resultado.exito).toBe(false);
    if (!resultado.exito) {
      expect(resultado.error).toContain("No tienes esta materia asignada");
    }
  });
});

describe("staff (oficina_central) sigue viendo/calificando todas las materias sin restricción", () => {
  it("cuentaA ve las calificaciones de ambas materias", async () => {
    const { data, error } = await cuentaA.supabase
      .from("calificaciones")
      .select("*")
      .eq("alumno_id", alumnoId)
      .in("materia_id", [materiaAsignadaId, materiaNoAsignadaId]);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("cuentaA puede registrar una calificación en la materia NO asignada a ningún docente", async () => {
    const resultado = await registrarCalificacion(cuentaA.supabase, {
      alumnoId,
      materiaId: materiaNoAsignadaId,
      periodo: "TEST-STAFF-SIN-RESTRICCION",
      calificacion: 7,
    });

    expect(resultado.exito).toBe(true);
  });
});
