"use client";

import { useActionState } from "react";
import { crearGrupoAction, type EstadoCrearGrupo } from "./acciones";

interface MateriaOpcion {
  id: string;
  nombre: string;
}

interface DocenteOpcion {
  id: string;
  nombre_completo: string;
}

const estadoInicial: EstadoCrearGrupo = {};

export function FormularioCrearGrupo({
  materias,
  docentes,
}: {
  materias: MateriaOpcion[];
  docentes: DocenteOpcion[];
}) {
  const [estado, accion, enviando] = useActionState(
    crearGrupoAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full flex-col gap-4">
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
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre" className="text-sm font-medium text-zinc-700">
          Nombre del grupo
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          placeholder="Grupo A"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
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
          htmlFor="docente_id"
          className="text-sm font-medium text-zinc-700"
        >
          Docente (opcional)
        </label>
        <select
          id="docente_id"
          name="docente_id"
          defaultValue=""
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="">Sin asignar todavía</option>
          {docentes.map((docente) => (
            <option key={docente.id} value={docente.id}>
              {docente.nombre_completo}
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
        {enviando ? "Creando..." : "Crear grupo"}
      </button>
    </form>
  );
}
