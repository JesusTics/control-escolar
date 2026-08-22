// Instancia lista para usar en los casos de uso, construida una sola vez a
// partir de `process.env.CIFRADO_CLAVE` — mismo patrón que
// `src/lib/supabase/client.ts`/`server.ts` (fallar rápido y explícito, sin
// fallback silencioso inseguro, si falta la clave o tiene el tamaño
// incorrecto).
//
// Separada de `cifrador-aes-gcm.ts` (que solo exporta la clase) a propósito:
// así los tests unitarios de `CifradorAesGcm`
// (`tests/dominio/cifrador.test.ts`) pueden importar la clase y construir
// sus propias instancias con una clave de prueba, sin que el simple hecho de
// importar el módulo dispare la construcción de esta instancia real (que
// leería `process.env.CIFRADO_CLAVE` y fallaría en CI/local si esa variable
// no está definida — no es necesaria para correr `npm test`, ver
// CLAUDE.md 4.4 y el reporte de la sesión que introdujo esto).
import { CifradorAesGcm } from "./cifrador-aes-gcm";
import type { ICifrador } from "./cifrador";

export const cifrador: ICifrador = new CifradorAesGcm(
  process.env.CIFRADO_CLAVE,
);
