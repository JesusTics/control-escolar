"use client";

import { useActionState } from "react";
import {
  cambiarDocenteGrupoAction,
  type EstadoCambiarDocenteGrupo,
} from "./acciones";

interface DocenteOpcion {
  id: string;
  nombre_completo: string;
}

const estadoInicial: EstadoCambiarDocenteGrupo = {};

export function SelectorDocenteGrupo({
  grupoId,
  docenteIdActual,
  docentes,
}: {
  grupoId: string;
  docenteIdActual: string | null;
  docentes: DocenteOpcion[];
}) {
  const accionConGrupo = cambiarDocenteGrupoAction.bind(null, grupoId);
  const [estado, accion, enviando] = useActionState(
    accionConGrupo,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex flex-col gap-2">
      <label htmlFor="docente_id" className="text-sm font-medium text-zinc-700">
        Docente asignado
      </label>
      <div className="flex gap-2">
        <select
          id="docente_id"
          name="docente_id"
          defaultValue={docenteIdActual ?? ""}
          className="h-12 flex-1 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="">Sin asignar</option>
          {docentes.map((docente) => (
            <option key={docente.id} value={docente.id}>
              {docente.nombre_completo}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={enviando}
          className="h-12 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {enviando ? "Guardando..." : "Cambiar"}
        </button>
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
    </form>
  );
}
