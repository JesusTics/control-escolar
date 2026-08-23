// Vista de kardex (calificaciones + asistencia) de un alumno, extraída como
// componente compartido para no duplicar el layout base (CLAUDE.md — evitar
// duplicación) entre `/alumnos/[id]` (staff/docente consultando el kardex de
// cualquier alumno de su plantel) y el portal de alumno en `/dashboard`
// (un alumno consultando SU propio kardex).
//
// `puedeGestionar` oculta los botones de "Registrar calificación"/"Capturar
// asistencia" en el portal de alumno — esas acciones solo las puede
// completar staff/docente (ver políticas `..._insert_staff_mismo_plantel` de
// calificaciones/asistencias), mostrarlas ahí llevaría a un botón que
// siempre falla por RLS, contrario a CLAUDE.md 7 ("texto explícito", nunca
// una acción que no se puede completar).
import Link from "next/link";
import type { Kardex } from "@/modules/calificaciones/casos-uso/obtener-kardex-alumno";
import type { AsistenciaAlumno } from "@/modules/asistencia/casos-uso/obtener-asistencia-alumno";

export function VistaKardexAlumno({
  kardex,
  asistencia,
  idAlumno,
  puedeGestionar,
}: {
  kardex: Kardex;
  asistencia: AsistenciaAlumno;
  idAlumno: string;
  puedeGestionar: boolean;
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {kardex.alumno.nombre_completo}
        </h1>
        <p className="text-zinc-600">Matrícula: {kardex.alumno.matricula}</p>
      </div>

      {kardex.datosSensibles && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              Datos sensibles
            </h2>
            <Link
              href={`/alumnos/${idAlumno}/datos-sensibles`}
              className="text-sm font-medium text-zinc-900 underline"
            >
              Editar datos sensibles
            </Link>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-col">
              <span className="font-medium text-zinc-700">
                Nombre del tutor
              </span>
              <span className="text-zinc-900">
                {kardex.datosSensibles.tutorNombre ?? "No capturado"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-zinc-700">
                Teléfono del tutor
              </span>
              <span className="text-zinc-900">
                {kardex.datosSensibles.tutorTelefono ?? "No capturado"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-zinc-700">
                Información médica
              </span>
              <span className="text-zinc-900">
                {kardex.datosSensibles.informacionMedica ?? "No capturado"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-6">
        <span className="text-sm font-medium text-zinc-600">
          Promedio general
        </span>
        <span className="text-4xl font-bold text-zinc-900">
          {kardex.promedioGeneral !== null
            ? kardex.promedioGeneral.toFixed(2)
            : "—"}
        </span>
      </div>

      {puedeGestionar && (
        <Link
          href={`/alumnos/${idAlumno}/calificaciones/nueva`}
          className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Registrar calificación
        </Link>
      )}

      {kardex.calificaciones.length === 0 ? (
        <p className="text-center text-zinc-600">
          Todavía no hay calificaciones registradas.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {kardex.calificaciones.map((calificacion) => (
            <div
              key={calificacion.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="font-medium text-zinc-900">
                  {calificacion.materiaNombre} — {calificacion.grupoNombre}
                </span>
                <span className="text-sm text-zinc-600">
                  Periodo: {calificacion.periodo}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-zinc-900">
                  {calificacion.calificacion}
                </span>
                <span
                  className={
                    calificacion.aprobado
                      ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                      : "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
                  }
                >
                  {calificacion.aprobado ? "Aprobado" : "Reprobado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-6">
        <span className="text-sm font-medium text-zinc-600">
          Porcentaje de asistencia
        </span>
        <span className="text-4xl font-bold text-zinc-900">
          {asistencia.porcentaje !== null
            ? `${asistencia.porcentaje.toFixed(0)}%`
            : "—"}
        </span>
      </div>

      {puedeGestionar && (
        <Link
          href="/asistencia"
          className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Capturar asistencia
        </Link>
      )}

      {asistencia.registros.length === 0 ? (
        <p className="text-center text-zinc-600">
          Todavía no hay registros de asistencia.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {asistencia.registros.slice(0, 10).map((registro) => (
            <div
              key={registro.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="font-medium text-zinc-900">
                {registro.fecha}
              </span>
              <span
                className={
                  registro.estado === "presente"
                    ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                    : registro.estado === "retardo"
                      ? "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
                      : registro.estado === "justificado"
                        ? "rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700"
                        : "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
                }
              >
                {registro.estado}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
