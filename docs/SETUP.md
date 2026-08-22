# Setup — Plataforma de Control Escolar

> Guía para clonar y levantar el proyecto localmente desde cero. Estado
> actual: Oleada 1 del MVP completa (Identidad/Roles, Alumnos,
> Calificaciones, Asistencia, Comunicación, portales por rol) — ver
> `memory/CONTEXT.md` para el detalle sesión a sesión.

## Requisitos previos

- **Node.js 20** (misma versión que usa CI, ver `.github/workflows/ci.yml` y
  el comentario en `tests/setup.ts`; el proyecto no fija `engines` en
  `package.json`, pero usar una versión distinta puede dar problemas con el
  polyfill de `WebSocket` que necesita `@supabase/supabase-js` en Node < 22).
- **npm** (viene con Node; el repo usa `package-lock.json`, no otro gestor).
- **Git**.
- Una **cuenta de Supabase** (el plan gratuito es suficiente para
  desarrollo) — [supabase.com](https://supabase.com).

## Variables de entorno

Todas viven en `.env.local` en la raíz del proyecto (Next.js lo carga
automáticamente). **`.env.local` nunca se commitea** (está en `.gitignore`
junto con cualquier `.env*`, excepto `.env.example`) — usa `.env.example`
como plantilla:

```
cp .env.example .env.local
```

| Variable | Qué es | De dónde se obtiene |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. Pública (va al bundle del cliente, de ahí el prefijo `NEXT_PUBLIC_`). Usada en `src/lib/supabase/client.ts`, `server.ts` y `middleware.ts`. | Dashboard de Supabase del proyecto → **Settings → API → Project URL**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave `anon` (pública) de Supabase. El aislamiento real de datos lo da RLS en Postgres, no el secreto de esta clave (ver CLAUDE.md 4.3). | Dashboard de Supabase → **Settings → API → Project API keys → `anon` `public`**. |
| `CIFRADO_CLAVE` | Clave AES-256-GCM (32 bytes en base64) usada **solo en servidor** para cifrar en reposo los campos sensibles del expediente de alumno (contacto de tutor, datos médicos) — ver CLAUDE.md 4.4 y `src/lib/cifrado/`. Nunca debe llevar prefijo `NEXT_PUBLIC_*`. | Se genera localmente, no se obtiene de ningún dashboard. Comando exacto ya usado en este proyecto: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Genera una clave distinta por entorno** (desarrollo, CI, producción) — nunca reutilices la misma. |

Sin `CIFRADO_CLAVE` definida, `npm run dev`/`npm run build` funcionan pero
la sección de "Datos sensibles" del expediente de alumno falla al usarse
(`src/lib/cifrado/instancia.ts` falla rápido y explícito si la variable
falta o tiene el tamaño incorrecto, a propósito, en vez de un fallback
silencioso inseguro).

## Puesta en marcha local

1. **Clonar el repositorio:**

   ```
   git clone https://github.com/JesusTics/control-escolar.git
   cd control-escolar
   ```

2. **Crear un proyecto nuevo en Supabase** (dashboard →  New Project).
   Configura la región **`sa-east-1`** (São Paulo) — es la decisión ya
   tomada para este proyecto por cercanía a México, ver
   [ADR-0001](adr/0001-validacion-arquitectura-inicial.md). No es
   estrictamente necesario para que el proyecto funcione en local, pero
   mantiene consistencia con el proyecto de desarrollo/producción reales.

3. **Aplicar TODAS las migraciones, en orden, en el SQL Editor del
   dashboard de Supabase** (Database → SQL Editor). Todavía no hay Supabase
   CLI vinculado al proyecto remoto ni token configurado, así que el
   proceso es manual: abre cada archivo de `supabase/migrations/` y ejecuta
   su contenido completo, en este orden exacto (el nombre del archivo
   empieza con timestamp, así que también puedes ordenar por nombre):

   1. `20260822074551_fundacion_multitenant.sql`
   2. `20260822075713_alta_inicial_identidad.sql`
   3. `20260822165852_alumnos_alta_y_listado.sql`
   4. `20260822184852_materias_catalogo.sql`
   5. `20260822184856_calificaciones_registro_y_kardex.sql`
   6. `20260822190214_asistencia_diaria.sql`
   7. `20260822191115_avisos_tablon.sql`
   8. `20260822191914_invitaciones_plantel.sql`
   9. `20260822200141_vincular_alumno_a_perfil.sql`
   10. `20260822200144_endurecer_rls_visibilidad_por_rol.sql`
   11. `20260822210809_datos_sensibles_alumno.sql`
   12. `20260822213647_perfiles_visibles_mismo_plantel.sql`
   13. `20260822214000_solicitudes_arco.sql`

   El orden importa: varias migraciones dependen de tablas/columnas creadas
   por las anteriores (ej. la 9 y la 10 dependen de la fundación multi-tenant
   y de `alumnos`). Sin aplicar todas, `npm run dev` puede correr pero varias
   pantallas fallarán al consultar tablas inexistentes, y `npm test` fallará
   en los archivos de aislamiento correspondientes a la tabla que falte
   (patrón documentado repetidamente en `memory/CONTEXT.md`).

4. **Configurar `.env.local`** con los tres valores de la tabla de la
   sección anterior (URL y `anon key` del proyecto Supabase recién creado,
   más una `CIFRADO_CLAVE` generada localmente).

5. **(Opcional, para replicar el estado actual del proyecto de desarrollo)
   desactivar la confirmación de email**: dashboard de Supabase →
   **Authentication → Settings → desactivar "Confirm email"**. Esto es una
   **decisión de conveniencia para desarrollo, no la recomendada para
   producción** — el flujo de `/registro` soporta ambos modos (con y sin
   confirmación, ver `src/app/auth/callback/route.ts`), pero mantenerlo
   desactivado evita depender de recibir un correo real al probar
   localmente. Si lo dejas activado, cuando te registres deberás confirmar
   por correo antes de que se cree el plantel/perfil (detalle del flujo y
   pasos de prueba manual en `memory/CONTEXT.md`, entrada del
   2026-08-22 sobre confirmación de email).

6. **Instalar dependencias:**

   ```
   npm install
   ```

7. **Levantar el servidor de desarrollo:**

   ```
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000). Alternativa dentro
   de este entorno de Claude Code: la configuración `dev` de
   `.claude/launch.json` levanta el mismo `npm run dev` en el puerto 3000
   integrado con el flujo de preview del entorno — no es necesaria fuera de
   Claude Code, `npm run dev` directo es la ruta principal.

8. **Registrar el primer usuario** en
   [http://localhost:3000/registro](http://localhost:3000/registro): este
   formulario da de alta, en una sola acción, un plantel nuevo y el primer
   usuario de ese plantel con rol `oficina_central` (caso de uso
   `registrar-plantel-inicial`, función `security definer`
   `crear_plantel_y_perfil_inicial` en la migración de identidad). Con esa
   cuenta ya puedes iniciar sesión en `/login`, ver `/dashboard`, e invitar
   docentes/alumnos adicionales desde `/plantel/invitaciones`.

## Despliegue

### CI (GitHub Actions)

Configurado en `.github/workflows/ci.yml` (CLAUDE.md sección 5): corre en
cada `push`/`pull_request` a `main`, en `ubuntu-latest` con Node 20 (misma
versión que el entorno de desarrollo local, ver `tests/setup.ts`). Pasos:
`npm ci` (instalación reproducible, no `npm install`), `npm run lint`,
`npm run build`, `npm test`.

`npm test` corre contra el **proyecto Supabase real de desarrollo** (nunca
producción, nunca Supabase CLI/Docker local) — mismo criterio ya documentado
en la adenda de testing de
[ADR-0001](adr/0001-validacion-arquitectura-inicial.md#adenda-2026-08-22-estrategia-de-testing-de-aislamiento-rls).
Para que el job tenga esas credenciales, configura en el repo de GitHub,
**Settings → Secrets and variables → Actions → New repository secret**, los
tres secrets que consume `.github/workflows/ci.yml` (mismos valores que ya
tienes en tu `.env.local` local):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CIFRADO_CLAVE`

Las dos primeras son las credenciales `anon` — públicas por diseño (viven en
el bundle del cliente), no sensibles, pero se configuran como secrets del
repo de todas formas para no hardcodearlas en el workflow. `CIFRADO_CLAVE`
sí es sensible (ver sección "Variables de entorno" arriba) — usa una clave
generada para CI, no la misma de tu entorno de desarrollo local.

El repo remoto ya existe en GitHub (`origin` →
`https://github.com/JesusTics/control-escolar.git`, rama `main` local
sincronizada con `origin/main`), así que el workflow se dispara
automáticamente en cada push/PR a `main`. Si los dos secrets de arriba
todavía no están configurados en **Settings → Secrets and variables →
Actions** del repo, el job avanzará hasta el paso `npm test` y fallará ahí
con credenciales vacías (mismo síntoma que correr `npm test` en local sin
`.env.local`) — configúralos siguiendo los pasos de arriba si aún no
se ha hecho.

### Vercel

_Pendiente._ No hay proyecto de Vercel configurado todavía (sin `vercel.json`
ni integración detectada en el repo). Cuando se configure: framework preset
Next.js (autodetectado), región `gru1` (São Paulo, misma decisión que
Supabase — ver [ADR-0001](adr/0001-validacion-arquitectura-inicial.md)), y
las mismas tres variables de entorno de la sección "Variables de entorno"
configuradas en el proyecto de Vercel (Settings → Environment Variables),
usando las credenciales del proyecto Supabase de **producción**, no las de
desarrollo.
