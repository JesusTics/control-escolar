# Setup — Plataforma de Control Escolar

> Estado: proyecto nuevo, sin código todavía. Este documento se irá llenando
> conforme se inicialice el repositorio y la infraestructura.

## Requisitos previos

_Pendiente._

## Variables de entorno

_Pendiente — nunca commitear valores reales, solo `.env.example`._

## Puesta en marcha local

_Pendiente._

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
**Settings → Secrets and variables → Actions → New repository secret**, dos
secrets con los mismos valores que ya tienes en tu `.env.local` local:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Son las credenciales `anon` — públicas por diseño (viven en el bundle del
cliente), no sensibles, pero se configuran como secrets del repo de todas
formas para no hardcodearlas en el workflow.

El workflow ya está en el repo pero queda **inactivo** hasta que exista un
remoto en GitHub con estos secrets configurados — ver `memory/CONTEXT.md`
para el estado exacto.

### Vercel

_Pendiente._
