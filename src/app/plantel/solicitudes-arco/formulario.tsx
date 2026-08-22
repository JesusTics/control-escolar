"use client";

import { useActionState } from "react";
import {
  resolverSolicitudArcoAction,
  type EstadoResolverSolicitudArco,
} from "./acciones";

const estadoInicial: EstadoResolverSolicitudArco = {};

export function FormularioResolverSolicitud({
  solicitudId,
}: {
  solicitudId: string;
}) {
  const accionConId = resolverSolicitudArcoAction.bind(null, solicitudId);
  const [estado, accion, enviando] = useActionState(
    accionConId,
    estadoInicial,
  );

  if (estado.exito) {
    return (
      <p className="text-sm font-medium text-green-700" role="status">
        Solicitud marcada como resuelta.
      </p>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-2">
      <label
        htmlFor={`respuesta-${solicitudId}`}
        className="text-sm font-medium text-zinc-700"
      >
        Respuesta
      </label>
      <textarea
        id={`respuesta-${solicitudId}`}
        name="respuesta"
        required
        rows={2}
        placeholder="Ej. se corrigió el dato el 22/08/2026"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      {estado.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="h-10 self-start rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Marcar como resuelta"}
      </button>
    </form>
  );
}
