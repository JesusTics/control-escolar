"use client";

import { useActionState } from "react";
import type { InscripcionConAlumno } from "@/modules/grupos/dominio/grupo";
import type { EstadoAsistencia } from "@/modules/asistencia/dominio/asistencia";
import {
  registrarAsistenciaAction,
  type EstadoRegistrarAsistencia,
} from "./acciones";

const estadoInicial: EstadoRegistrarAsistencia = {};

// "presente" va primero y es el `defaultValue` de cada select — la mayoría
// de los días la mayoría de los alumnos asisten, así que preseleccionarlo
// minimiza clics (CLAUDE.md 7: UX radicalmente simple).
const OPCIONES_ESTADO: { valor: EstadoAsistencia; etiqueta: string }[] = [
  { valor: "presente", etiqueta: "Presente" },
  { valor: "ausente", etiqueta: "Ausente" },
  { valor: "retardo", etiqueta: "Retardo" },
  { valor: "justificado", etiqueta: "Justificado" },
];

export function FormularioCapturaAsistencia({
  grupoId,
  alumnos,
  fechaInicial,
}: {
  grupoId: string;
  alumnos: InscripcionConAlumno[];
  fechaInicial: string;
}) {
  const [estado, accion, enviando] = useActionState(
    registrarAsistenciaAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full flex-col gap-6">
      <input type="hidden" name="grupoId" value={grupoId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="fecha" className="text-sm font-medium text-zinc-700">
          Fecha
        </label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          required
          defaultValue={fechaInicial}
          className="h-12 w-full max-w-xs rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>

      <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {alumnos.map((inscripcion) => (
          <div
            key={inscripcion.alumno_id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <input
              type="hidden"
              name="alumnoId"
              value={inscripcion.alumno_id}
            />
            <div className="flex flex-col">
              <span className="font-medium text-zinc-900">
                {inscripcion.alumnoNombre}
              </span>
              <span className="text-sm text-zinc-600">
                Matrícula: {inscripcion.alumnoMatricula}
              </span>
            </div>
            <select
              name={`estado-${inscripcion.alumno_id}`}
              defaultValue="presente"
              className="h-12 rounded-lg border border-zinc-300 px-3 text-base"
            >
              {OPCIONES_ESTADO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {estado.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}

      {estado.exito && (
        <p className="text-sm font-medium text-green-700" role="status">
          Asistencia guardada.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="h-14 rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar asistencia"}
      </button>
    </form>
  );
}
