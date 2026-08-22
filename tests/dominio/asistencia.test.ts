// Tests unitarios de dominio — sin red, sin Supabase (CLAUDE.md 5, TDD-lite
// en lógica crítica: cálculo de asistencia).
import { describe, expect, it } from "vitest";
import { calcularPorcentajeAsistencia } from "@/modules/asistencia/dominio/asistencia";

describe("calcularPorcentajeAsistencia", () => {
  it("devuelve null para un arreglo vacío (no divide entre cero)", () => {
    expect(calcularPorcentajeAsistencia([])).toBeNull();
  });

  it("100% cuando todos los registros son presente", () => {
    expect(
      calcularPorcentajeAsistencia([
        { estado: "presente" },
        { estado: "presente" },
        { estado: "presente" },
      ]),
    ).toBe(100);
  });

  it("retardo cuenta como asistencia (a favor)", () => {
    expect(
      calcularPorcentajeAsistencia([
        { estado: "presente" },
        { estado: "retardo" },
      ]),
    ).toBe(100);
  });

  it("mezcla con ausentes: ausente cuenta en el denominador pero no a favor", () => {
    expect(
      calcularPorcentajeAsistencia([
        { estado: "presente" },
        { estado: "presente" },
        { estado: "ausente" },
        { estado: "ausente" },
      ]),
    ).toBe(50);
  });

  it("justificado se excluye del denominador: no penaliza ni favorece", () => {
    // 1 presente, 1 justificado -> el justificado se excluye por completo,
    // así que el porcentaje es 100% (1/1), no 50% (1/2).
    expect(
      calcularPorcentajeAsistencia([
        { estado: "presente" },
        { estado: "justificado" },
      ]),
    ).toBe(100);
  });

  it("null cuando todos los registros son justificados (denominador vacío tras excluirlos)", () => {
    expect(
      calcularPorcentajeAsistencia([
        { estado: "justificado" },
        { estado: "justificado" },
      ]),
    ).toBeNull();
  });

  it("calcula porcentajes no exactos sin redondear de forma implícita", () => {
    // 2 de 3 -> 66.66...%
    const resultado = calcularPorcentajeAsistencia([
      { estado: "presente" },
      { estado: "presente" },
      { estado: "ausente" },
    ]);
    expect(resultado).toBeCloseTo(66.6667, 3);
  });
});
