import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { obtenerAlumnoVinculado } from "@/modules/alumnos/casos-uso/obtener-alumno-vinculado";
import { obtenerKardexAlumno } from "@/modules/calificaciones/casos-uso/obtener-kardex-alumno";
import { obtenerAsistenciaAlumno } from "@/modules/asistencia/casos-uso/obtener-asistencia-alumno";
import { listarAvisos } from "@/modules/comunicacion/casos-uso/listar-avisos";
import { VistaKardexAlumno } from "@/app/alumnos/[id]/vista-kardex";
import { BotonCerrarSesion } from "./boton-cerrar-sesion";

// Portales por rol (CLAUDE.md sección 3, último ítem del MVP): la
// navegación depende de lo que cada rol puede hacer en realidad, en vez de
// mostrar el mismo menú completo a todos.
//
// `alumno` no usa esta lista de navegación — tiene su propia vista dedicada
// (`PortalAlumno`, más abajo): su kardex + sus avisos directamente, no un
// menú para elegir a dónde ir (ver diseño de la sesión: la lista genérica de
// `/alumnos` ya no tiene sentido para este rol, la RLS la reduce a una sola
// fila).
interface ItemNav {
  href: string;
  etiqueta: string;
}

const NAV_STAFF: ItemNav[] = [
  { href: "/alumnos", etiqueta: "Alumnos" },
  { href: "/materias", etiqueta: "Materias" },
  { href: "/asistencia", etiqueta: "Asistencia" },
  { href: "/avisos", etiqueta: "Avisos" },
  { href: "/plantel/invitaciones", etiqueta: "Invitar usuarios" },
];

// `docente`: sin Materias (solo staff administrativo crea materias) ni
// Invitar usuarios (solo staff da de alta cuentas).
const NAV_DOCENTE: ItemNav[] = [
  { href: "/alumnos", etiqueta: "Alumnos" },
  { href: "/asistencia", etiqueta: "Asistencia" },
  { href: "/avisos", etiqueta: "Avisos" },
];

export default async function PaginaDashboard() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await obtenerPerfilActual(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { perfil } = resultado;

  // Red de seguridad, no el camino principal: cuando la confirmación de
  // email está activada, `/auth/callback` (ver
  // src/app/auth/callback/route.ts) ya se encarga de crear el plantel/perfil
  // en cuanto el usuario confirma, y redirige aquí solo cuando ya existe. Si
  // de todas formas se llega a `/dashboard` con sesión pero sin perfil (ej.
  // alguien borra el perfil manualmente, o llega por una vía que se saltó el
  // callback), se avisa en vez de fallar o entrar en un loop de redirects.
  if (!perfil) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Tu cuenta todavía no tiene un plantel asociado
        </h1>
        <p className="max-w-md text-zinc-600">
          Esto puede pasar si confirmaste tu correo antes de completar el
          registro. Contacta a soporte para terminar de configurar tu cuenta.
        </p>
        <BotonCerrarSesion />
      </div>
    );
  }

  if (perfil.rol === "alumno") {
    return (
      <PortalAlumno
        supabase={supabase}
        perfilId={perfil.id}
        nombreCompleto={perfil.nombre_completo}
        nombrePlantel={perfil.plantel?.nombre ?? null}
      />
    );
  }

  const navItems = perfil.rol === "docente" ? NAV_DOCENTE : NAV_STAFF;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 py-16 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Bienvenido, {perfil.nombre_completo}
        </h1>
        <p className="text-lg text-zinc-600">
          Plantel: {perfil.plantel?.nombre ?? "Sin plantel asociado"}
        </p>
        <p className="text-lg text-zinc-600">Rol: {perfil.rol}</p>
      </div>

      <nav className="flex w-full max-w-xs flex-col gap-3">
        {navItems.map((item, indice) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              indice === 0
                ? "flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
                : "flex h-14 w-full items-center justify-center rounded-lg border border-zinc-300 text-lg font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
            }
          >
            {item.etiqueta}
          </Link>
        ))}
      </nav>

      <BotonCerrarSesion />
    </div>
  );
}

// Portal de alumno: su kardex (calificaciones + asistencia, mismo componente
// que usa staff/docente en `/alumnos/[id]`, pero sin las acciones de
// gestión) y sus avisos, directamente — no un menú de navegación (ver
// comentario de cabecera).
async function PortalAlumno({
  supabase,
  perfilId,
  nombreCompleto,
  nombrePlantel,
}: {
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  perfilId: string;
  nombreCompleto: string;
  nombrePlantel: string | null;
}) {
  const resultadoAlumno = await obtenerAlumnoVinculado(supabase, perfilId);

  if (!resultadoAlumno.exito) {
    throw new Error(resultadoAlumno.error);
  }

  if (!resultadoAlumno.alumno) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Tu cuenta todavía no está vinculada a un expediente de alumno
        </h1>
        <p className="max-w-md text-zinc-600">
          Contacta a la administración de tu plantel para que vinculen tu
          cuenta con tu expediente de alumno.
        </p>
        <BotonCerrarSesion />
      </div>
    );
  }

  const idAlumno = resultadoAlumno.alumno.id;

  const [resultadoKardex, resultadoAsistencia, resultadoAvisos] =
    await Promise.all([
      obtenerKardexAlumno(supabase, idAlumno),
      obtenerAsistenciaAlumno(supabase, idAlumno),
      listarAvisos(supabase),
    ]);

  if (!resultadoKardex.exito) {
    throw new Error(resultadoKardex.error);
  }

  if (!resultadoAsistencia.exito) {
    throw new Error(resultadoAsistencia.error);
  }

  if (!resultadoAvisos.exito) {
    throw new Error(resultadoAvisos.error);
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Bienvenido, {nombreCompleto}
          </h1>
          <p className="text-zinc-600">
            Plantel: {nombrePlantel ?? "Sin plantel asociado"}
          </p>
        </div>

        <VistaKardexAlumno
          kardex={resultadoKardex.kardex}
          asistencia={resultadoAsistencia.asistencia}
          idAlumno={idAlumno}
          puedeGestionar={false}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-semibold text-zinc-900">
            Avisos
          </h2>
          {resultadoAvisos.avisos.length === 0 ? (
            <p className="text-center text-zinc-600">
              Todavía no hay avisos publicados.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {resultadoAvisos.avisos.map((aviso) => (
                <div
                  key={aviso.id}
                  className="flex flex-col gap-2 px-4 py-4"
                >
                  <span className="font-semibold text-zinc-900">
                    {aviso.titulo}
                  </span>
                  <p className="whitespace-pre-wrap text-zinc-700">
                    {aviso.contenido}
                  </p>
                  <span className="text-sm text-zinc-500">
                    {aviso.autorNombre} ·{" "}
                    {new Date(aviso.created_at).toLocaleString("es-MX")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <BotonCerrarSesion />
      </div>
    </div>
  );
}
