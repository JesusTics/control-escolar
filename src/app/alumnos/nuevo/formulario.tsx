"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  inscribirAlumnoAction,
  type EstadoInscripcionAlumno,
} from "./acciones";

const estadoInicial: EstadoInscripcionAlumno = {};

export function FormularioInscribirAlumno() {
  const [estado, accion, enviando] = useActionState(
    inscribirAlumnoAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="matricula"
          className="text-sm font-medium text-zinc-700"
        >
          Matrícula
        </label>
        <input
          id="matricula"
          name="matricula"
          type="text"
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="nombreCompleto"
          className="text-sm font-medium text-zinc-700"
        >
          Nombre completo
        </label>
        <input
          id="nombreCompleto"
          name="nombreCompleto"
          type="text"
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="fechaNacimiento"
          className="text-sm font-medium text-zinc-700"
        >
          Fecha de nacimiento (opcional)
        </label>
        <input
          id="fechaNacimiento"
          name="fechaNacimiento"
          type="date"
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
        {enviando ? "Inscribiendo..." : "Inscribir"}
      </button>
      <Link
        href="/alumnos"
        className="text-center text-sm font-medium text-zinc-900 underline"
      >
        Cancelar
      </Link>
    </form>
  );
}
