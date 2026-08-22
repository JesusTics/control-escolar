import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

// Página pública (sin necesidad de sesión) — es intencional: el aviso de
// privacidad debe poder consultarse antes de crear una cuenta (LFPDPPP,
// CLAUDE.md 4.4), no solo después de iniciar sesión.
export default async function PaginaAvisoPrivacidad() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nombreResponsable = "la institución educativa que opera esta plataforma";

  if (user) {
    const resultadoPerfil = await obtenerPerfilActual(supabase);

    if (resultadoPerfil.exito && resultadoPerfil.perfil?.plantel?.nombre) {
      nombreResponsable = resultadoPerfil.perfil.plantel.nombre;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Aviso de privacidad
          </h1>
          <p className="text-zinc-600">
            Conforme a la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares (LFPDPPP)
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-800">
          {/*
            NOTA PARA IMPLEMENTACIÓN EN PRODUCCIÓN: este texto usa el nombre
            del plantel de la sesión actual (o un texto genérico si no hay
            sesión) como identidad del responsable, por no existir todavía un
            catálogo de datos legales por institución (razón social, RFC,
            domicilio fiscal, datos de contacto del responsable de datos
            personales). Cada institución que opere esta plataforma en
            producción DEBE completar sus propios datos legales reales antes
            de capturar cualquier dato personal — este aviso genérico no es
            jurídicamente suficiente por sí solo para ese fin.
          */}

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              1. Identidad del responsable
            </h2>
            <p>
              El responsable del tratamiento de tus datos personales es{" "}
              <strong>{nombreResponsable}</strong>, en su calidad de
              institución educativa que administra tu información dentro de
              esta plataforma de control escolar.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              2. Finalidades del tratamiento
            </h2>
            <p>Tus datos personales se recaban y tratan para:</p>
            <ul className="list-disc pl-6">
              <li>Gestionar tu expediente escolar (alta, inscripción, actualización).</li>
              <li>Registrar y consultar calificaciones y kardex académico.</li>
              <li>Registrar y consultar asistencia.</li>
              <li>
                Enviarte comunicados y avisos institucionales relevantes para
                tu rol dentro del plantel.
              </li>
              <li>
                Administrar el acceso a la plataforma según tu rol (alumno,
                docente, administrativo, oficina central).
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              3. Datos personales que se recaban
            </h2>
            <p>Dependiendo de tu rol, podemos recabar:</p>
            <ul className="list-disc pl-6">
              <li>Datos de identificación: nombre completo, matrícula, fecha de nacimiento.</li>
              <li>Datos de contacto: correo electrónico.</li>
              <li>
                Datos de contacto de tutores (nombre, teléfono), cuando
                aplique.
              </li>
              <li>
                Datos médicos sensibles (información médica relevante para el
                plantel), cuando aplique — estos datos se cifran en reposo
                antes de almacenarse.
              </li>
              <li>Datos académicos: calificaciones, asistencia.</li>
            </ul>
            <p>
              Al tratarse en muchos casos de datos de menores de edad, el
              interés superior del menor guía todo el tratamiento de estos
              datos: se recaba solo lo necesario para la gestión escolar y el
              acceso está restringido por rol.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              4. Derechos ARCO
            </h2>
            <p>
              Tienes derecho a Acceder a tus datos personales, Rectificarlos
              si son inexactos, Cancelarlos cuando consideres que no se
              requieren para las finalidades señaladas, y Oponerte al
              tratamiento de los mismos para fines específicos (derechos
              ARCO).
            </p>
            <p>
              Puedes ejercer cualquiera de estos derechos levantando una
              solicitud desde tu cuenta en{" "}
              <Link
                href="/derechos-arco"
                className="font-medium text-zinc-900 underline"
              >
                Derechos ARCO
              </Link>
              . El personal administrativo de tu plantel revisará y atenderá
              tu solicitud.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              5. Cambios a este aviso
            </h2>
            <p>
              Este aviso de privacidad puede actualizarse. Te recomendamos
              consultarlo periódicamente.
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="text-center text-sm font-medium text-zinc-900 underline"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
