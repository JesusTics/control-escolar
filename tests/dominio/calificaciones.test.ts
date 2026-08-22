// Tests unitarios de dominio — sin red, sin Supabase (CLAUDE.md 5, TDD-lite
// en lógica crítica: cálculo de calificaciones).
import { describe, expect, it } from "vitest";
import {
  NOTA_APROBATORIA,
  calcularPromedio,
  estaAprobado,
} from "@/modules/calificaciones/dominio/calificacion";

describe("estaAprobado", () => {
  it("una calificación exactamente en la nota aprobatoria (6) está aprobada", () => {
    expect(estaAprobado(NOTA_APROBATORIA)).toBe(true);
    expect(estaAprobado(6)).toBe(true);
  });

  it("una calificación por debajo de 6 no está aprobada", () => {
    expect(estaAprobado(5.9)).toBe(false);
    expect(estaAprobado(0)).toBe(false);
  });

  it("una calificación por arriba de 6 está aprobada", () => {
    expect(estaAprobado(6.1)).toBe(true);
    expect(estaAprobado(10)).toBe(true);
  });
});

describe("calcularPromedio", () => {
  it("devuelve null para un arreglo vacío (no divide entre cero)", () => {
    expect(calcularPromedio([])).toBeNull();
  });

  it("devuelve el mismo valor cuando hay un solo elemento", () => {
    expect(calcularPromedio([8])).toBe(8);
  });

  it("calcula el promedio de varios elementos", () => {
    expect(calcularPromedio([10, 8, 6])).toBe(8);
  });

  it("no redondea: conserva decimales exactos del promedio", () => {
    expect(calcularPromedio([10, 9, 8])).toBe(9);
    expect(calcularPromedio([10, 9])).toBeCloseTo(9.5);
    expect(calcularPromedio([7, 8, 9, 10])).toBeCloseTo(8.5);
  });
});
