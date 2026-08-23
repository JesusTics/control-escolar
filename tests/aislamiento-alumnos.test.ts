// Test de aislamiento DENTRO del mismo tenant — CLAUDE.md 4.3, hueco de
// seguridad cerrado en
// supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql.
//
// A diferencia del resto del suite (que verifica aislamiento ENTRE
// planteles, cuenta A vs. cuenta B), este archivo verifica aislamiento entre
// dos alumnos del MISMO plantel: una cuenta con rol `alumno` (vinculada al
// alumno X vía `alumnos.perfil_id`, ver
// supabase/migrations/20260822200141_vincular_alumno_a_perfil.sql) NO debe
// poder ver las calificaciones/asistencia de otro alumno (Y) de su propio
// plantel — solo las suyas. También confirma que staff (`oficina_central`)
// sigue viendo todo su plantel sin restricciones, sin cambio de
// comportamiento respecto a antes de endurecer la RLS.
//
// Reusa el helper de cuentas de prueba fijas (staff, tests/helpers/
// cuenta-prueba.ts) para el plantel y ambos alumnos. La cuenta con rol
// `alumno` es una cuenta de prueba fija adicional, dada de alta vía
// invitación con `alumno_id` — mismo patrón que
// tests/aislamiento-invitaciones.test.ts con `test-invitado@...`.
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
import { inscribirAlumnoGrupo } from "@/modules/grupos/casos-uso/inscribir-alumno-grupo";
import { crearInvitacion } from "@/modules/identidad/casos-uso/crear-invitacion";
import { aceptarInvitacion } from "@/modules/identidad/casos-uso/aceptar-invitacion";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL_A = "test-aislamiento-a@controlescolar.test";
const PASSWORD = "TestAislamiento123!";

// Matrículas propias de este archivo (distintas de TEST-A-001 que usan los
// demás suites) para no interferir con sus datos ni depender de un orden de
// ejecución entre archivos.
const MATRICULA_ALUMNO_X = "TEST-A-ALUMNO-VINCULADO";
const MATRICULA_ALUMNO_Y = "TEST-A-002";
const NOMBRE_MATERIA = "Historia (prueba aislamiento por rol)";
const NOMBRE_GRUPO = "Grupo A (prueba aislamiento por rol)";
const PERIODO = "2026-1";
const FECHA_ASISTENCIA = "2026-01-20";

const EMAIL_ALUMNO_X = "test-alumno-x@controlescolar.test";
const PASSWORD_ALUMNO_X = "TestAlumnoX123!";
const NOMBRE_ALUMNO_X = "Cuenta de Prueba Alumno X";

let cuentaA: CuentaDePrueba;
let alumnoIdX: string;
let alumnoIdY: string;
let supabaseAlumnoX: SupabaseClient;

beforeAll(async () => {
  cuentaA = await obtenerOCrearCuentaDePrueba(
    EMAIL_A,
    PASSWORD,
    "Plantel de Prueba A (aislamiento multi-tenant)",
    "Usuario de Prueba A",
  );

  // Alumno X: el que se vinculará a la cuenta con rol `alumno`.
  const resultadoX = await inscribirAlumno(cuentaA.supabase, {
    matricula: MATRICULA_ALUMNO_X,
    nombreCompleto: "Alumno X (vinculado a cuenta de prueba)",
  });
  if (!resultadoX.exito) {
    expect(resultadoX.error).toBe(
      "Ya existe un alumno con esa matrícula en este plantel.",
    );
  }

  // Alumno Y: otro alumno del MISMO plantel, sin cuenta vinculada, con datos
  // propios que X no debe poder ver.
  const resultadoY = await inscribirAlumno(cuentaA.supabase, {
    matricula: MATRICULA_ALUMNO_Y,
    nombreCompleto: "Alumno Y (datos ajenos a X)",
  });
  if (!resultadoY.exito) {
    expect(resultadoY.error).toBe(
      "Ya existe un alumno con esa matrícula en este plantel.",
    );
  }

  const listaAlumnos = await listarAlumnos(cuentaA.supabase);
  if (!listaAlumnos.exito) {
    throw new Error(`No se pudo listar alumnos de A: ${listaAlumnos.error}`);
  }
  const alumnoX = listaAlumnos.alumnos.find(
    (a) => a.matricula === MATRICULA_ALUMNO_X,
  );
  const alumnoY = listaAlumnos.alumnos.find(
    (a) => a.matricula === MATRICULA_ALUMNO_Y,
  );
  if (!alumnoX || !alumnoY) {
    throw new Error("No se encontraron los alumnos de prueba X/Y.");
  }
  alumnoIdX = alumnoX.id;
  alumnoIdY = alumnoY.id;

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
  const materiaId = materia.id;

  // Grupo de prueba e inscripción de AMBOS alumnos (X e Y) — requisito de
  // integridad del nuevo esquema (supabase/migrations/
  // 20260823003328_grupos_e_inscripciones.sql y siguientes): no se puede
  // calificar/tomar asistencia a un alumno que no está inscrito en el
  // grupo. Ambos comparten grupo a propósito: el aislamiento que prueba
  // este archivo es por `alumno_id` (rol `alumno` viendo solo lo suyo), no
  // por grupo — ver tests/aislamiento-grupos.test.ts para el aislamiento
  // por titularidad docente<->grupo.
  const resultadoGrupo = await crearGrupo(cuentaA.supabase, {
    materiaId,
    nombre: NOMBRE_GRUPO,
    periodo: PERIODO,
  });
  if (!resultadoGrupo.exito) {
    expect(resultadoGrupo.error).toBe(
      "Ya existe un grupo con ese nombre para esa materia y periodo.",
    );
  }

  const listaGrupos = await listarGruposPlantel(cuentaA.supabase);
  if (!listaGrupos.exito) {
    throw new Error(`No se pudo listar grupos de A: ${listaGrupos.error}`);
  }
  const grupo = listaGrupos.grupos.find(
    (g) => g.materia_id === materiaId && g.nombre === NOMBRE_GRUPO && g.periodo === PERIODO,
  );
  if (!grupo) {
    throw new Error("No se encontró el grupo de prueba.");
  }
  const grupoId = grupo.id;

  for (const alumnoId of [alumnoIdX, alumnoIdY]) {
    const resultadoInscripcion = await inscribirAlumnoGrupo(cuentaA.supabase, {
      alumnoId,
      grupoId,
    });
    if (!resultadoInscripcion.exito) {
      expect(resultadoInscripcion.error).toBe(
        "Este alumno ya está inscrito en este grupo.",
      );
    }
  }

  // Calificación y asistencia de Y — lo que X NO debe poder ver.
  const resultadoCalifY = await registrarCalificacion(cuentaA.supabase, {
    alumnoId: alumnoIdY,
    grupoId,
    calificacion: 9,
  });
  if (!resultadoCalifY.exito) {
    throw new Error(
      `No se pudo registrar la calificación de Y: ${resultadoCalifY.error}`,
    );
  }

  const resultadoAsistY = await registrarAsistenciaDelDia(cuentaA.supabase, {
    grupoId,
    fecha: FECHA_ASISTENCIA,
    registros: [{ alumnoId: alumnoIdY, estado: "presente" }],
  });
  if (!resultadoAsistY.exito) {
    throw new Error(
      `No se pudo registrar la asistencia de Y: ${resultadoAsistY.error}`,
    );
  }

  // Calificación y asistencia propias de X — lo que X SÍ debe poder ver.
  const resultadoCalifX = await registrarCalificacion(cuentaA.supabase, {
    alumnoId: alumnoIdX,
    grupoId,
    calificacion: 7,
  });
  if (!resultadoCalifX.exito) {
    throw new Error(
      `No se pudo registrar la calificación de X: ${resultadoCalifX.error}`,
    );
  }

  const resultadoAsistX = await registrarAsistenciaDelDia(cuentaA.supabase, {
    grupoId,
    fecha: FECHA_ASISTENCIA,
    registros: [{ alumnoId: alumnoIdX, estado: "presente" }],
  });
  if (!resultadoAsistX.exito) {
    throw new Error(
      `No se pudo registrar la asistencia de X: ${resultadoAsistX.error}`,
    );
  }

  // Cuenta con rol `alumno`, vinculada a X vía invitación con `alumno_id`.
  // Cliente independiente, sin persistir sesión — se comporta como un
  // navegador nuevo (mismo criterio que obtenerOCrearCuentaDePrueba).
  supabaseAlumnoX = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const inicioSesion = await supabaseAlumnoX.auth.signInWithPassword({
    email: EMAIL_ALUMNO_X,
    password: PASSWORD_ALUMNO_X,
  });

  let perfilYaExiste = false;
  if (!inicioSesion.error) {
    const perfilExistente = await obtenerPerfilConReintento(supabaseAlumnoX);
    if (!perfilExistente.exito) {
      throw new Error(
        `No se pudo leer el perfil de la cuenta alumno X: ${perfilExistente.error}`,
      );
    }
    perfilYaExiste = !!perfilExistente.perfil;
  }

  if (!perfilYaExiste) {
    // Primera corrida (o una corrida anterior que falló a medias): se crea
    // una invitación nueva con `alumno_id = X` y se acepta con la cuenta de
    // prueba del alumno. Idempotente entre corridas: si el perfil ya existe,
    // este bloque no se vuelve a ejecutar.
    const resultadoInvitacion = await crearInvitacion(cuentaA.supabase, {
      email: EMAIL_ALUMNO_X,
      rol: "alumno",
      alumnoId: alumnoIdX,
    });
    if (!resultadoInvitacion.exito) {
      throw new Error(
        `No se pudo crear la invitación de la cuenta alumno X: ${resultadoInvitacion.error}`,
      );
    }

    const resultadoAceptar = await aceptarInvitacion(supabaseAlumnoX, {
      token: resultadoInvitacion.invitacion.token,
      email: EMAIL_ALUMNO_X,
      password: PASSWORD_ALUMNO_X,
      nombreCompleto: NOMBRE_ALUMNO_X,
    });
    if (!resultadoAceptar.exito) {
      throw new Error(
        `No se pudo aceptar la invitación de la cuenta alumno X: ${resultadoAceptar.error}`,
      );
    }
  }
});

describe("aislamiento dentro del mismo plantel (RLS) — cuenta alumno solo ve lo propio", () => {
  it("el alumno X ve su propia fila en alumnos, pero NO la del alumno Y", async () => {
    const propia = await supabaseAlumnoX
      .from("alumnos")
      .select("*")
      .eq("id", alumnoIdX);
    expect(propia.error).toBeNull();
    expect(propia.data).toHaveLength(1);

    const ajena = await supabaseAlumnoX
      .from("alumnos")
      .select("*")
      .eq("id", alumnoIdY);
    expect(ajena.error).toBeNull();
    expect(ajena.data).toEqual([]);
  });

  it("el alumno X ve su propia calificación", async () => {
    const { data, error } = await supabaseAlumnoX
      .from("calificaciones")
      .select("*")
      .eq("alumno_id", alumnoIdX);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el alumno X NO ve la calificación del alumno Y (mismo plantel)", async () => {
    const { data, error } = await supabaseAlumnoX
      .from("calificaciones")
      .select("*")
      .eq("alumno_id", alumnoIdY);

    // RLS filtra la fila en vez de devolver un error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el alumno X ve su propia asistencia", async () => {
    const { data, error } = await supabaseAlumnoX
      .from("asistencias")
      .select("*")
      .eq("alumno_id", alumnoIdX);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el alumno X NO ve la asistencia del alumno Y (mismo plantel)", async () => {
    const { data, error } = await supabaseAlumnoX
      .from("asistencias")
      .select("*")
      .eq("alumno_id", alumnoIdY);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("visibilidad de perfiles dentro del mismo plantel (colegas) — migración 20260822213647", () => {
  // `perfiles_select_mismo_plantel` reemplazó a `perfiles_select_propio`
  // para que joins como `autor:perfiles(nombre_completo)` en
  // `listar-avisos.ts` puedan resolver el nombre de cualquier colega del
  // mismo plantel, no solo el propio. El aislamiento ENTRE planteles sigue
  // cubierto por "el usuario A no puede ver el perfil del usuario B" en
  // tests/aislamiento-multitenant.test.ts (planteles distintos) — este test
  // cubre el caso complementario, DENTRO del mismo plantel.
  it("el alumno X SÍ puede ver el nombre_completo del perfil de cuentaA (mismo plantel)", async () => {
    const { data, error } = await supabaseAlumnoX
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", cuentaA.perfil.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.nombre_completo).toBe(cuentaA.perfil.nombre_completo);
  });
});

describe("staff (oficina_central) sigue viendo todo su plantel sin restricciones", () => {
  it("cuentaA ve a los alumnos X y Y en su listado", async () => {
    const resultado = await listarAlumnos(cuentaA.supabase);

    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(resultado.alumnos.some((a) => a.id === alumnoIdX)).toBe(true);
      expect(resultado.alumnos.some((a) => a.id === alumnoIdY)).toBe(true);
    }
  });

  it("cuentaA ve las calificaciones de X y de Y", async () => {
    const { data, error } = await cuentaA.supabase
      .from("calificaciones")
      .select("*")
      .in("alumno_id", [alumnoIdX, alumnoIdY]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("cuentaA ve la asistencia de X y de Y", async () => {
    const { data, error } = await cuentaA.supabase
      .from("asistencias")
      .select("*")
      .in("alumno_id", [alumnoIdX, alumnoIdY]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});
