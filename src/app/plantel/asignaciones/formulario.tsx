"use client";

import { useActionState } from "react";
import {
  asignarDocenteMateriaAction,
  type EstadoAsignarDocenteMateria,
} from "./acciones";

interface DocenteOpcion {
  id: string;
  nombre_completo: string;
}

interface MateriaOpcion {
  id: string;
  nombre: string;
}

const estadoInicial: EstadoAsignarDocenteMateria = {};

export function FormularioAsignarDocenteMateria({
  docentes,
  materias,
}: {
  docentes: DocenteOpcion[];
  materias: MateriaOpcion[];
}) {
  const [estado, accion, enviando] = useActionState(
    asignarDocenteMateriaAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="docente_id"
          className="text-sm font-medium text-zinc-700"
        >
          Docente
        </label>
        <select
          id="docente_id"
          name="docente_id"
          required
          defaultValue=""
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="" disabled>
            Selecciona un docente
          </option>
          {docentes.map((docente) => (
            <option key={docente.id} value={docente.id}>
              {docente.nombre_completo}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="materia_id"
          className="text-sm font-medium text-zinc-700"
        >
          Materia
        </label>
        <select
          id="materia_id"
          name="materia_id"
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
      {estado.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p className="text-sm font-medium text-green-700" role="status">
          {estado.mensaje}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="h-14 rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Asignando..." : "Asignar materia"}
      </button>
    </form>
  );
}
