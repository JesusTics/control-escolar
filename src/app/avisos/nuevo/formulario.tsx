"use client";

import { useActionState } from "react";
import Link from "next/link";
import { publicarAvisoAction, type EstadoPublicarAviso } from "./acciones";

const estadoInicial: EstadoPublicarAviso = {};

export function FormularioPublicarAviso() {
  const [estado, accion, enviando] = useActionState(
    publicarAvisoAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="titulo" className="text-sm font-medium text-zinc-700">
          Título
        </label>
        <input
          id="titulo"
          name="titulo"
          type="text"
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="contenido"
          className="text-sm font-medium text-zinc-700"
        >
          Contenido
        </label>
        <textarea
          id="contenido"
          name="contenido"
          required
          rows={6}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="dirigidoA"
          className="text-sm font-medium text-zinc-700"
        >
          Dirigido a
        </label>
        <select
          id="dirigidoA"
          name="dirigidoA"
          defaultValue="todos"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="todos">Todos</option>
          <option value="docentes">Docentes</option>
          <option value="alumnos">Alumnos</option>
        </select>
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
        {enviando ? "Publicando..." : "Publicar aviso"}
      </button>
      <Link
        href="/avisos"
        className="text-center text-sm font-medium text-zinc-900 underline"
      >
        Cancelar
      </Link>
    </form>
  );
}
