// Tipos y lógica de dominio del bounded context Asistencia.
// Reflejan la forma de la tabla `public.asistencias` definida en
// `supabase/migrations/20260822190214_asistencia_diaria.sql` y actualizada
// en `supabase/migrations/20260823003336_asistencia_por_grupo.sql`.
//
// Sin dependencias de Supabase ni de red — testeable en aislamiento total
// (ver tests/dominio/asistencia.test.ts). Aplica hexagonal ligero aquí
// (CLAUDE.md 4.1): Asistencia es, junto con Calificaciones e
// Identidad/Roles, uno de los ejemplos textuales de "lógica de negocio no
// trivial" que justifica aislar el dominio del framework/proveedor.

export type EstadoAsistencia =
  | "presente"
  | "ausente"
  | "retardo"
  | "justificado";

// Desde 20260823003336_asistencia_por_grupo.sql: la asistencia se toma por
// sesión de grupo, no de forma general del plantel — un alumno puede tener
// asistencia distinta en dos materias el mismo día (`unique(alumno_id,
// grupo_id, fecha)` en vez de `unique(alumno_id, fecha)`).
export interface Asistencia {
  id: string;
  plantel_id: string;
  alumno_id: string;
  grupo_id: string;
  fecha: string;
  estado: EstadoAsistencia;
  created_at: string;
  updated_at: string;
}

/**
 * Calcula el porcentaje de asistencia sobre un conjunto de registros.
 *
 * Regla de negocio (no obvia, documentada aquí a propósito):
 * - `presente` y `retardo` cuentan como asistencia (a favor).
 * - `ausente` cuenta en el denominador pero no a favor (penaliza).
 * - `justificado` se EXCLUYE por completo del cálculo (ni numerador ni
 *   denominador) — una ausencia justificada no debería penalizar el
 *   porcentaje del alumno, pero tampoco es lo mismo que haber asistido.
 *
 * Devuelve `null` si no hay registros no-justificados (nunca divide entre
 * cero), igual que `calcularPromedio` en el módulo Calificaciones.
 */
export function calcularPorcentajeAsistencia(
  registros: { estado: string }[],
): number | null {
  const registrosContables = registros.filter(
    (r) => r.estado !== "justificado",
  );

  if (registrosContables.length === 0) {
    return null;
  }

  const asistencias = registrosContables.filter(
    (r) => r.estado === "presente" || r.estado === "retardo",
  ).length;

  return (asistencias / registrosContables.length) * 100;
}
