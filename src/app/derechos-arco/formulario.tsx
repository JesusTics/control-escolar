"use client";

import { useActionState } from "react";
import { crearSolicitudArcoAction, type EstadoCrearSolicitudArco } from "./acciones";

const estadoInicial: EstadoCrearSolicitudArco = {};

const OPCIONES_TIPO = [
  { valor: "acceso", etiqueta: "Acceso — quiero saber qué datos tienen de mí" },
  { valor: "rectificacion", etiqueta: "Rectificación — un dato mío está incorrecto" },
  { valor: "cancelacion", etiqueta: "Cancelación — quiero que dejen de usar un dato mío" },
  { valor: "oposicion", etiqueta: "Oposición — me opongo a un uso específico de mis datos" },
];

export function FormularioSolicitudArco() {
  const [estado, accion, enviando] = useActionState(
    crearSolicitudArcoAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="tipo" className="text-sm font-medium text-zinc-700">
          Tipo de solicitud
        </label>
        <select
          id="tipo"
          name="tipo"
          defaultValue="acceso"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          {OPCIONES_TIPO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="descripcion"
          className="text-sm font-medium text-zinc-700"
        >
          Describe tu solicitud
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          required
          rows={5}
          placeholder="Ej. quiero corregir mi fecha de nacimiento en mi expediente"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base"
        />
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
        {enviando ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
