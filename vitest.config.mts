import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuración de Vitest para los tests de aislamiento multi-tenant (RLS).
// Corren contra el proyecto Supabase remoto de desarrollo real (no local,
// sin Docker) — ver docs/adr/0001-validacion-arquitectura-inicial.md,
// adenda "Estrategia de testing de aislamiento RLS". El timeout se sube
// respecto al default de Vitest porque cada test hace llamadas de red reales
// a Supabase Auth/Postgrest, no llamadas mockeadas.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
