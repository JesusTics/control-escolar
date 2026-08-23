"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { GrupoDeAlumno } from "@/modules/grupos/dominio/grupo";
import {
  registrarCalificacionAction,
  type EstadoRegistrarCalificacion,
} from "./acciones";

const estadoInicial: EstadoRegistrarCalificacion = {};

export function FormularioRegistrarCalificacion({
  alumnoId,
  grupos,
}: {
  alumnoId: string;
  grupos: GrupoDeAlumno[];
}) {
  const accionConAlumno = registrarCalificacionAction.bind(null, alumnoId);
  const [estado, accion, enviando] = useActionState(
    accionConAlumno,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="grupoId" className="text-sm font-medium text-zinc-700">
          Grupo
        </label>
        <select
          id="grupoId"
          name="grupoId"
          required
          defaultValue=""
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="" disabled>
            Selecciona un grupo
          </option>
          {grupos.map((grupo) => (
            <option key={grupo.grupoId} value={grupo.grupoId}>
              {grupo.materiaNombre} — {grupo.grupoNombre} ({grupo.periodo})
            </option>
          ))}
        </select>
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
