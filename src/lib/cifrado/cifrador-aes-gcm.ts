// Implementación concreta de `ICifrador` con AES-256-GCM (autenticado) vía
// el módulo `crypto` nativo de Node — sin librerías de cifrado de terceros
// (CLAUDE.md 4.4: "cifrado en reposo para campos sensibles... más allá de lo
// que da por default la infraestructura").
//
// Decisión de diseño — cifrado en capa de aplicación, NO en Postgres
// (`pgcrypto`/`pgsodium`): así la clave de cifrado nunca vive en la base de
// datos, solo en una variable de entorno del servidor (`CIFRADO_CLAVE`). Si
// alguien compromete solo la base de datos (un dump, o el propio dashboard
// de Supabase), no puede descifrar nada sin además tener esa clave. Ver
// adenda de ADR-0001 para el razonamiento completo.
//
// Formato del texto cifrado almacenado (un solo string base64, para que baste
// una columna `text` en Postgres):
//   base64( IV (12 bytes) | ciphertext (N bytes) | authTag (16 bytes) )
// El IV es aleatorio y distinto en cada llamada a `cifrar` (no negociable —
// reutilizar un IV con GCM rompe la confidencialidad). El authTag detecta
// manipulación del ciphertext al descifrar (autenticación, no solo
// confidencialidad — por eso GCM y no un modo como CBC).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ICifrador } from "./cifrador";

const ALGORITMO = "aes-256-gcm";
const LARGO_CLAVE_BYTES = 32; // AES-256
const LARGO_IV_BYTES = 12; // tamaño recomendado de IV para GCM
const LARGO_AUTH_TAG_BYTES = 16;

function leerClave(claveBase64: string | undefined): Buffer {
  if (!claveBase64) {
    throw new Error(
      "Falta la variable de entorno CIFRADO_CLAVE (servidor, nunca " +
        "NEXT_PUBLIC_*). Genera una con: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" ` +
        "y agrégala a tu .env.local.",
    );
  }

  const clave = Buffer.from(claveBase64, "base64");

  if (clave.length !== LARGO_CLAVE_BYTES) {
    throw new Error(
      `CIFRADO_CLAVE debe decodificar a ${LARGO_CLAVE_BYTES} bytes (AES-256) ` +
        `en base64; se obtuvieron ${clave.length} bytes. Genera una clave ` +
        "válida con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\".",
    );
  }

  return clave;
}

export class CifradorAesGcm implements ICifrador {
  private readonly clave: Buffer;

  constructor(claveBase64: string | undefined) {
    this.clave = leerClave(claveBase64);
  }

  cifrar(textoPlano: string): string {
    const iv = randomBytes(LARGO_IV_BYTES);
    const cipher = createCipheriv(ALGORITMO, this.clave, iv);

    const ciphertext = Buffer.concat([
      cipher.update(textoPlano, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
  }

  descifrar(cifrado: string): string {
    const datos = Buffer.from(cifrado, "base64");

    if (datos.length < LARGO_IV_BYTES + LARGO_AUTH_TAG_BYTES) {
      throw new Error("Formato de texto cifrado inválido: demasiado corto.");
    }

    const iv = datos.subarray(0, LARGO_IV_BYTES);
    const authTag = datos.subarray(datos.length - LARGO_AUTH_TAG_BYTES);
    const ciphertext = datos.subarray(
      LARGO_IV_BYTES,
      datos.length - LARGO_AUTH_TAG_BYTES,
    );

    const decipher = createDecipheriv(ALGORITMO, this.clave, iv);
    decipher.setAuthTag(authTag);

    // Si el ciphertext o el authTag fueron manipulados, `final()` lanza
    // (verificación de autenticación de GCM) en vez de devolver datos
    // corruptos en silencio.
    const textoPlano = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return textoPlano.toString("utf8");
  }
}
