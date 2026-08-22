// Setup global de Vitest: carga las variables de entorno de `.env.local`
// (las mismas credenciales anon de Supabase que usa la app en desarrollo) y
// aplica un polyfill necesario en este entorno de ejecución.
import { config } from "dotenv";
import { resolve } from "node:path";
import WebSocket from "ws";

// Funciona igual en local y en CI (GitHub Actions) sin lógica condicional:
// `dotenv.config()` nunca sobreescribe una variable que ya exista en
// `process.env` (comportamiento default de la librería, sin `override`).
// En local no hay `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` en el proceso
// todavía, así que se toman de `.env.local`. En CI no existe `.env.local`
// (nunca se commitea, ver .gitignore) — `config()` falla en silencio (ENOENT)
// y las variables ya están pobladas por el job de GitHub Actions
// (`.github/workflows/ci.yml`, desde `secrets.*`) antes de que este archivo
// corra.
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

// `@supabase/supabase-js` instancia un `RealtimeClient` en el constructor de
// `createClient`, que requiere `WebSocket` como global — disponible de forma
// nativa desde Node 22, pero este proyecto corre en Node 20 (ver
// package.json/engines si se define). Estos tests no usan Realtime, pero el
// cliente falla al construirse sin este polyfill.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error - polyfill mínimo de Node, no se usa en runtime real
  globalThis.WebSocket = WebSocket;
}
