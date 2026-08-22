"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearMateriaAction, type EstadoCrearMateria } from "./acciones";

const estadoInicial: EstadoCrearMateria = {};

export function FormularioCrearMateria() {
  const [estado, accion, enviando] = useActionState(
    crearMateriaAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre" className="text-sm font-medium text-zinc-700">
          Nombre de la materia
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
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
        href="/materias"
        className="text-center text-sm font-medium text-zinc-900 underline"
      >
        Cancelar
      </Link>
    </form>
  );
}
