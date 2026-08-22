"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Materia } from "@/modules/calificaciones/dominio/calificacion";
import {
  registrarCalificacionAction,
  type EstadoRegistrarCalificacion,
} from "./acciones";

const estadoInicial: EstadoRegistrarCalificacion = {};

export function FormularioRegistrarCalificacion({
  alumnoId,
  materias,
}: {
  alumnoId: string;
  materias: Materia[];
}) {
  const accionConAlumno = registrarCalificacionAction.bind(null, alumnoId);
  const [estado, accion, enviando] = useActionState(
    accionConAlumno,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="materiaId"
          className="text-sm font-medium text-zinc-700"
        >
          Materia
        </label>
        <select
          id="materiaId"
          name="materiaId"
          required
          defaultValue=""
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="" disabled>
            Selecciona una materia
          </option>
          {materias.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="periodo" className="text-sm font-medium text-zinc-700">
          Periodo
        </label>
        <input
          id="periodo"
          name="periodo"
          type="text"
          required
          placeholder="2026-1"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="calificacion"
          className="text-sm font-medium text-zinc-700"
        >
          Calificación
        </label>
        <input
          id="calificacion"
          name="calificacion"
          type="number"
          min={0}
          max={10}
          step={0.1}
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      {estado.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="h-14 rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar"}
      </button>
      <Link
        href={`/alumnos/${alumnoId}`}
        className="text-center text-sm font-medium text-zinc-900 underline"
      >
        Cancelar
      </Link>
    </form>
  );
}
