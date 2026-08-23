// Caso de uso: obtener el kardex (calificaciones) de un alumno, con el
// nombre de cada materia, el promedio general y si el alumno está aprobado
// en cada una.
//
// Sin promedio por materia (una sola calificación por materia/periodo,
// ver alcance de la tarea) — "aprobado" se calcula directo sobre esa
// calificación individual con `estaAprobado` (dominio puro, sin red).
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularPromedio, estaAprobado } from "../dominio/calificacion";
import type { Alumno } from "@/modules/alumnos/dominio/alumno";
import { cifrador } from "@/lib/cifrado/instancia";
import type { Rol } from "@/modules/identidad/dominio/perfil";

export interface CalificacionKardex {
  id: string;
  grupoId: string;
  grupoNombre: string;
  materiaNombre: string;
  periodo: string;
  calificacion: number;
  aprobado: boolean;
}

// Datos sensibles ya descifrados (texto plano), listos para mostrarse en la
// UI. Un campo individual `null` significa "no capturado" (columna vacía en
// la base); el objeto completo `datosSensibles` siendo `null` en `Kardex`
// significa "no autorizado a verlos" — dos cosas distintas, ver más abajo.
export interface DatosSensiblesAlumno {
  tutorNombre: string | null;
  tutorTelefono: string | null;
  informacionMedica: string | null;
}

export interface Kardex {
  alumno: Alumno;
  calificaciones: CalificacionKardex[];
  promedioGeneral: number | null;
  // `null` para cualquier rol que no sea `administrativo`/`oficina_central`
  // (incluye `docente` y `alumno`, y también cuando el rol no se pudo
  // determinar) — decisión de autorización a nivel de APLICACIÓN, no de RLS.
  // RLS (`alumnos_select_propio_o_staff`) ya permite a `docente` ver la fila
  // completa de `alumnos` (matrícula, nombre, etc.), pero estos tres campos
  // son más sensibles (contacto de tutor, datos médicos) que el resto del
  // expediente — el cifrado en sí más esta verificación de rol aquí es la
  // capa adicional que los protege incluso de quien sí puede ver el resto
  // del expediente por RLS.
  datosSensibles: DatosSensiblesAlumno | null;
}

export type ResultadoKardexAlumno =
  | { exito: true; kardex: Kardex }
  | { exito: false; error: string };

const ROLES_CON_ACCESO_A_DATOS_SENSIBLES: ReadonlySet<Rol> = new Set([
  "administrativo",
  "oficina_central",
]);

interface FilaCalificacionConGrupo {
  id: string;
  grupo_id: string;
  calificacion: number;
  grupo: {
    nombre: string;
    periodo: string;
    materia: { nombre: string } | null;
  } | null;
}

export async function obtenerKardexAlumno(
  supabase: SupabaseClient,
  alumnoId: string,
  rolActual?: Rol,
): Promise<ResultadoKardexAlumno> {
  const { data: alumno, error: errorAlumno } = await supabase
    .from("alumnos")
    .select("*")
    .eq("id", alumnoId)
    .maybeSingle();

  if (errorAlumno) {
    return { exito: false, error: errorAlumno.message };
  }

  if (!alumno) {
    return { exito: false, error: "No se encontró el alumno." };
  }

  // Sin `order` sobre `periodo` a nivel de consulta: esa columna ahora vive
  // en `grupos` (tabla anidada), no directamente en `calificaciones` — se
  // ordena por fecha de captura en la base y, si hace falta un orden visual
  // por periodo, se resuelve en la UI. Ver
  // supabase/migrations/20260823003332_calificaciones_por_grupo.sql.
  const { data: filas, error: errorCalificaciones } = await supabase
    .from("calificaciones")
    .select(
      "id, grupo_id, calificacion, grupo:grupos(nombre, periodo, materia:materias(nombre))",
    )
    .eq("alumno_id", alumnoId)
    .order("created_at", { ascending: false });

  if (errorCalificaciones) {
    return { exito: false, error: errorCalificaciones.message };
  }

  const calificaciones: CalificacionKardex[] = (
    filas as unknown as FilaCalificacionConGrupo[]
  ).map((fila) => ({
    id: fila.id,
    grupoId: fila.grupo_id,
    grupoNombre: fila.grupo?.nombre ?? "Grupo desconocido",
    materiaNombre: fila.grupo?.materia?.nombre ?? "Materia desconocida",
    periodo: fila.grupo?.periodo ?? "—",
    calificacion: fila.calificacion,
    aprobado: estaAprobado(fila.calificacion),
  }));

  const promedioGeneral = calcularPromedio(
    calificaciones.map((c) => c.calificacion),
  );

  const alumnoTipado = alumno as Alumno;

  let datosSensibles: DatosSensiblesAlumno | null = null;
  if (rolActual && ROLES_CON_ACCESO_A_DATOS_SENSIBLES.has(rolActual)) {
    try {
      datosSensibles = {
        tutorNombre: alumnoTipado.tutor_nombre_cifrado
          ? cifrador.descifrar(alumnoTipado.tutor_nombre_cifrado)
          : null,
        tutorTelefono: alumnoTipado.tutor_telefono_cifrado
          ? cifrador.descifrar(alumnoTipado.tutor_telefono_cifrado)
          : null,
        informacionMedica: alumnoTipado.informacion_medica_cifrada
          ? cifrador.descifrar(alumnoTipado.informacion_medica_cifrada)
          : null,
      };
    } catch {
      return {
        exito: false,
        error: "No se pudieron leer los datos sensibles del alumno.",
      };
    }
  }

  return {
    exito: true,
    kardex: {
      alumno: alumnoTipado,
      calificaciones,
      promedioGeneral,
      datosSensibles,
    },
  };
}
