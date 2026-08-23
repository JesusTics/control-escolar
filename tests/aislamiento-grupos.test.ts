// Tests de aislamiento multi-tenant (RLS) — CLAUDE.md 4.3, módulo Grupos
// (supabase/migrations/20260823003328_grupos_e_inscripciones.sql,
// 20260823003332_calificaciones_por_grupo.sql,
// 20260823003336_asistencia_por_grupo.sql). Mismo enfoque que el resto del
// suite: SDK cliente contra el proyecto Supabase remoto de desarrollo
// (nunca SQL Editor ni `service_role`).
//
// Reemplaza tests/aislamiento-docente-materias.test.ts (retirado junto con
// `public.docente_materias`, ver
// supabase/migrations/20260823003340_retirar_docente_materias.sql) — migra
// su misma intención de aislamiento DENTRO del mismo tenant, ahora acotada a
// `grupos.docente_id` en vez de una asignación general a la materia:
//
// 1. Un docente titular de un grupo puede calificar/tomar asistencia de
//    alumnos inscritos en ESE grupo.
// 2. El mismo docente NO puede hacerlo en un grupo donde no es el titular
//    (`grupos.docente_id` distinto), aunque el alumno sí esté inscrito ahí.
// 3. Un alumno NO inscrito en un grupo no puede recibir una calificación ni
//    asistencia en él — rechazado por la validación de integridad
//    (`exists ... inscripciones` en el WITH CHECK), incluso para staff.
// 4. Staff sigue con visibilidad/escritura completa sin restricción de
//    titularidad (solo sujeto a la validación de integridad del punto 3).
//
// Cuenta de docente propia de este archivo (mismo email que usaba
// tests/aislamiento-docente-materias.test.ts, reutilizada — ya existe en el
// proyecto Supabase de desarrollo, no hace falta una cuenta nueva) para no
// competir por la misma invitación/cuenta con otro archivo que corre en un
// worker independiente.
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
import { registrarAsistenciaDelDia } from "@/modules/asistencia/casos-uso/registrar-asistencia-del-dia";
import { crearGrupo } from "@/modules/grupos/casos-uso/crear-grupo";
import { listarGruposPlantel } from "@/modules/grupos/casos-uso/listar-grupos-plantel";
import { asignarDocenteGrupo } from "@/modules/grupos/casos-uso/asignar-docente-grupo";
import { inscribirAlumnoGrupo } from "@/modules/grupos/casos-uso/inscribir-alumno-grupo";
import { crearInvitacion } from "@/modules/identidad/casos-uso/crear-invitacion";
import { aceptarInvitacion } from "@/modules/identidad/casos-uso/aceptar-invitacion";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const PASSWORD = "TestAislamiento123!";

// Matrículas/nombres propios de este archivo (distintos de TEST-A-001 y de
// los demás suites) para no interferir con sus datos ni depender de un
// orden de ejecución entre archivos.
const MATRICULA_ALUMNO_INSCRITO = "TEST-A-GRUPOS-INSCRITO";
const MATRICULA_ALUMNO_NO_INSCRITO = "TEST-A-GRUPOS-NO-INSCRITO";
const NOMBRE_MATERIA = "Matemáticas (prueba grupos)";
const NOMBRE_GRUPO_ASIGNADO = "Grupo Asignado (prueba grupos)";
const NOMBRE_GRUPO_NO_ASIGNADO = "Grupo No Asignado (prueba grupos)";
const PERIODO = "2026-1";
const FECHA_ASISTENCIA = "2026-01-25";

const EMAIL_DOCENTE = "test-docente-materias@controlescolar.test";
const PASSWORD_DOCENTE = "TestDocenteMaterias123!";
const NOMBRE_DOCENTE = "Cuenta de Prueba Docente con Asignación";

let cuentaA: CuentaDePrueba;
let alumnoIdInscrito: string;
let alumnoIdNoInscrito: string;
let grupoIdAsignado: string;
let grupoIdNoAsignado: string;
let supabaseDocente: SupabaseClient;
let docentePerfilId: string;

beforeAll(async () => {
  cuentaA = await obtenerOCrearCuentaDePrueba(
    EMAIL_A,
    PASSWORD,
    "Plantel de Prueba A (aislamiento multi-tenant)",
    "Usuario de Prueba A",
  );

  // Dos alumnos de prueba, idempotentes entre corridas: uno se inscribirá en
  // ambos grupos, el otro se queda sin inscribir a propósito (caso 3).
  for (const [matricula, nombre] of [
    [MATRICULA_ALUMNO_INSCRITO, "Alumno inscrito (prueba grupos)"],
    [MATRICULA_ALUMNO_NO_INSCRITO, "Alumno no inscrito (prueba grupos)"],
  ]) {
    const resultado = await inscribirAlumno(cuentaA.supabase, {
      matricula,
      nombreCompleto: nombre,
    });
    if (!resultado.exito) {
      expect(resultado.error).toBe(
        "Ya existe un alumno con esa matrícula en este plantel.",
      );
    }
  }

  const listaAlumnos = await listarAlumnos(cuentaA.supabase);
  if (!listaAlumnos.exito) {
    throw new Error(`No se pudo listar alumnos de A: ${listaAlumnos.error}`);
  }
  const alumnoInscrito = listaAlumnos.alumnos.find(
    (a) => a.matricula === MATRICULA_ALUMNO_INSCRITO,
  );
  const alumnoNoInscrito = listaAlumnos.alumnos.find(
    (a) => a.matricula === MATRICULA_ALUMNO_NO_INSCRITO,
  );
  if (!alumnoInscrito || !alumnoNoInscrito) {
    throw new Error("No se encontraron los alumnos de prueba.");
  }
  alumnoIdInscrito = alumnoInscrito.id;
  alumnoIdNoInscrito = alumnoNoInscrito.id;

  const resultadoMateria = await crearMateria(cuentaA.supabase, {
    nombre: NOMBRE_MATERIA,
  });
  if (!resultadoMateria.exito) {
    expect(resultadoMateria.error).toBe(
      "Ya existe una materia con ese nombre en este plantel.",
    );
  }

  const listaMaterias = await listarMaterias(cuentaA.supabase);
  if (!listaMaterias.exito) {
    throw new Error(`No se pudo listar materias de A: ${listaMaterias.error}`);
  }
  const materia = listaMaterias.materias.find((m) => m.nombre === NOMBRE_MATERIA);
  if (!materia) {
    throw new Error("No se encontró la materia de prueba.");
  }

  // Dos grupos de la misma materia: uno se asignará al docente de prueba,
  // el otro se queda sin ese docente como titular.
  for (const nombreGrupo of [NOMBRE_GRUPO_ASIGNADO, NOMBRE_GRUPO_NO_ASIGNADO]) {
    const resultado = await crearGrupo(cuentaA.supabase, {
      materiaId: materia.id,
      nombre: nombreGrupo,
      periodo: PERIODO,
    });
    if (!resultado.exito) {
      expect(resultado.error).toBe(
        "Ya existe un grupo con ese nombre para esa materia y periodo.",
      );
    }
  }

  const listaGrupos = await listarGruposPlantel(cuentaA.supabase);
  if (!listaGrupos.exito) {
    throw new Error(`No se pudo listar grupos de A: ${listaGrupos.error}`);
  }
  const grupoAsignado = listaGrupos.grupos.find(
    (g) => g.materia_id === materia.id && g.nombre === NOMBRE_GRUPO_ASIGNADO,
  );
  const grupoNoAsignado = listaGrupos.grupos.find(
    (g) => g.materia_id === materia.id && g.nombre === NOMBRE_GRUPO_NO_ASIGNADO,
  );
  if (!grupoAsignado || !grupoNoAsignado) {
    throw new Error("No se encontraron los grupos de prueba.");
  }
  grupoIdAsignado = grupoAsignado.id;
  grupoIdNoAsignado = grupoNoAsignado.id;

  // El alumno "inscrito" se inscribe en AMBOS grupos, para aislar el caso
  // "docente no es titular" del caso "alumno no inscrito" — si solo
  // estuviera inscrito en el grupo asignado, un rechazo en el grupo no
  // asignado sería ambiguo entre ambas causas.
  for (const grupoId of [grupoIdAsignado, grupoIdNoAsignado]) {
    const resultado = await inscribirAlumnoGrupo(cuentaA.supabase, {
      alumnoId: alumnoIdInscrito,
      grupoId,
    });
    if (!resultado.exito) {
      expect(resultado.error).toBe(
        "Este alumno ya está inscrito en este grupo.",
      );
    }
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

  // El docente de prueba es titular SOLO del grupo asignado — idempotente
  // (volver a asignar el mismo docente es un simple UPDATE).
  const resultadoAsignar = await asignarDocenteGrupo(cuentaA.supabase, {
    grupoId: grupoIdAsignado,
    docenteId: docentePerfilId,
  });
  if (!resultadoAsignar.exito) {
    throw new Error(
      `No se pudo asignar el docente al grupo: ${resultadoAsignar.error}`,
    );
  }
});

describe("docente titular de un grupo puede calificar/tomar asistencia de alumnos inscritos", () => {
  it("puede registrar una calificación en su grupo", async () => {
    const resultado = await registrarCalificacion(supabaseDocente, {
      alumnoId: alumnoIdInscrito,
      grupoId: grupoIdAsignado,
      calificacion: 9,
    });

    expect(resultado.exito).toBe(true);
  });

  it("ve la calificación que acaba de registrar", async () => {
    const { data, error } = await supabaseDocente
      .from("calificaciones")
      .select("*")
      .eq("grupo_id", grupoIdAsignado)
      .eq("alumno_id", alumnoIdInscrito);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("puede registrar asistencia en su grupo", async () => {
    const resultado = await registrarAsistenciaDelDia(supabaseDocente, {
      grupoId: grupoIdAsignado,
      fecha: FECHA_ASISTENCIA,
      registros: [{ alumnoId: alumnoIdInscrito, estado: "presente" }],
    });

    expect(resultado.exito).toBe(true);
  });

  it("ve la asistencia que acaba de registrar", async () => {
    const { data, error } = await supabaseDocente
      .from("asistencias")
      .select("*")
      .eq("grupo_id", grupoIdAsignado)
      .eq("alumno_id", alumnoIdInscrito)
      .eq("fecha", FECHA_ASISTENCIA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("el mismo docente NO puede calificar/tomar asistencia en un grupo donde no es titular", () => {
  it("no puede registrar una calificación en el grupo no asignado (aunque el alumno sí está inscrito ahí)", async () => {
    const resultado = await registrarCalificacion(supabaseDocente, {
      alumnoId: alumnoIdInscrito,
      grupoId: grupoIdNoAsignado,
      calificacion: 10,
    });

    expect(resultado.exito).toBe(false);
    if (!resultado.exito) {
      expect(resultado.error).toContain("No tienes este grupo asignado");
    }
  });

  it("no ve calificaciones del grupo no asignado (RLS filtra la fila)", async () => {
    const { data, error } = await supabaseDocente
      .from("calificaciones")
      .select("*")
      .eq("grupo_id", grupoIdNoAsignado);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("no puede registrar asistencia en el grupo no asignado", async () => {
    const resultado = await registrarAsistenciaDelDia(supabaseDocente, {
      grupoId: grupoIdNoAsignado,
      fecha: FECHA_ASISTENCIA,
      registros: [{ alumnoId: alumnoIdInscrito, estado: "presente" }],
    });

    expect(resultado.exito).toBe(false);
  });
});

describe("un alumno NO inscrito en un grupo no puede recibir calificación ni asistencia ahí", () => {
  it("staff no puede registrar una calificación a un alumno no inscrito (validación de integridad)", async () => {
    const resultado = await registrarCalificacion(cuentaA.supabase, {
      alumnoId: alumnoIdNoInscrito,
      grupoId: grupoIdAsignado,
      calificacion: 8,
    });

    expect(resultado.exito).toBe(false);
    if (!resultado.exito) {
      expect(resultado.error).toBe(
        "Este alumno no está inscrito en este grupo.",
      );
    }
  });

  it("staff no puede registrar asistencia a un alumno no inscrito (validación de integridad)", async () => {
    const resultado = await registrarAsistenciaDelDia(cuentaA.supabase, {
      grupoId: grupoIdAsignado,
      fecha: FECHA_ASISTENCIA,
      registros: [{ alumnoId: alumnoIdNoInscrito, estado: "presente" }],
    });

    expect(resultado.exito).toBe(false);
  });
});

describe("staff sigue con visibilidad/escritura completa, sin restricción de titularidad", () => {
  it("cuentaA ve las calificaciones de ambos grupos para el alumno inscrito", async () => {
    const { data, error } = await cuentaA.supabase
      .from("calificaciones")
      .select("*")
      .eq("alumno_id", alumnoIdInscrito)
      .in("grupo_id", [grupoIdAsignado, grupoIdNoAsignado]);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("cuentaA puede registrar una calificación en el grupo NO asignado a ningún docente titular", async () => {
    const resultado = await registrarCalificacion(cuentaA.supabase, {
      alumnoId: alumnoIdInscrito,
      grupoId: grupoIdNoAsignado,
      calificacion: 7,
    });

    expect(resultado.exito).toBe(true);
  });
});
