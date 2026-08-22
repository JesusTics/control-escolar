"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  actualizarDatosSensiblesAction,
  type EstadoActualizarDatosSensibles,
} from "./acciones";

const estadoInicial: EstadoActualizarDatosSensibles = {};

export function FormularioDatosSensibles({
  alumnoId,
  valoresIniciales,
}: {
  alumnoId: string;
  valoresIniciales: {
    tutorNombre: string;
    tutorTelefono: string;
    informacionMedica: string;
  };
}) {
  const accionConAlumno = actualizarDatosSensiblesAction.bind(null, alumnoId);
  const [estado, accion, enviando] = useActionState(
    accionConAlumno,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="tutorNombre"
          className="text-sm font-medium text-zinc-700"
        >
          Nombre del tutor
        </label>
        <input
          id="tutorNombre"
          name="tutorNombre"
          type="text"
          defaultValue={valoresIniciales.tutorNombre}
          placeholder="Opcional"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="tutorTelefono"
          className="text-sm font-medium text-zinc-700"
        >
          Teléfono del tutor
        </label>
        <input
          id="tutorTelefono"
          name="tutorTelefono"
          type="tel"
          defaultValue={valoresIniciales.tutorTelefono}
          placeholder="Opcional"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="informacionMedica"
          className="text-sm font-medium text-zinc-700"
        >
          Información médica
        </label>
        <textarea
          id="informacionMedica"
          name="informacionMedica"
          defaultValue={valoresIniciales.informacionMedica}
          placeholder="Opcional — alergias, condiciones médicas relevantes, etc."
          rows={4}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base"
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
