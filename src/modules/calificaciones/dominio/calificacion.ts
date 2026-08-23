// Tipos y lógica de dominio del bounded context Calificaciones.
// Reflejan la forma de las tablas `public.materias` / `public.calificaciones`
// definidas en `supabase/migrations/20260822184852_materias_catalogo.sql` y
// `supabase/migrations/20260823003332_calificaciones_por_grupo.sql`.
//
// Sin dependencias de Supabase ni de red — testeable en aislamiento total
// (ver tests/dominio/calificaciones.test.ts). Aplica hexagonal ligero aquí
// (CLAUDE.md 4.1): es exactamente el ejemplo de "lógica de negocio no
// trivial" que el documento usa para Calificaciones (promedios, reprobación).

export interface Materia {
  id: string;
  plantel_id: string;
  nombre: string;
  created_at: string;
}

// Desde 20260823003332_calificaciones_por_grupo.sql: una calificación se
// registra por (alumno, grupo) — el grupo (bounded context Grupos, ver
// src/modules/grupos/) ya trae la materia y el periodo, así que dejaron de
// ser columnas directas de esta tabla. Reemplaza el modelo anterior de
// (alumno, materia, periodo) directo.
export interface Calificacion {
  id: string;
  plantel_id: string;
  alumno_id: string;
  grupo_id: string;
  calificacion: number;
  created_at: string;
  updated_at: string;
}

// Escala 0-10 (estándar del sistema educativo mexicano); 6 es la mínima
// aprobatoria en la gran mayoría de instituciones tipo TecNM/AMBAR.
export const NOTA_APROBATORIA = 6;

export function estaAprobado(calificacion: number): boolean {
  return calificacion >= NOTA_APROBATORIA;
}

export function calcularPromedio(calificaciones: number[]): number | null {
  if (calificaciones.length === 0) {
    return null;
  }

  const suma = calificaciones.reduce((total, valor) => total + valor, 0);
  return suma / calificaciones.length;
}
