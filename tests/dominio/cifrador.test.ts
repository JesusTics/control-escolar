// Tests unitarios de CifradorAesGcm — sin red, sin Supabase (CLAUDE.md 5,
// TDD-lite en lógica crítica: es el mecanismo que protege campos sensibles
// de LFPDPPP, CLAUDE.md 4.4).
//
// Importa la CLASE directamente desde `cifrador-aes-gcm.ts` (no la instancia
// singleton de `src/lib/cifrado/instancia.ts`) y construye sus propias
// instancias con una clave de prueba generada en el propio archivo — así
// este test no depende de `CIFRADO_CLAVE` en el entorno real (ver
// comentario en `src/lib/cifrado/instancia.ts` sobre por qué están
// separados).
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CifradorAesGcm } from "@/lib/cifrado/cifrador-aes-gcm";

const CLAVE_DE_PRUEBA = randomBytes(32).toString("base64");

describe("CifradorAesGcm", () => {
  it("ida y vuelta: descifrar(cifrar(texto)) devuelve el texto original exacto", () => {
    const cifrador = new CifradorAesGcm(CLAVE_DE_PRUEBA);
    const original = "Tel. tutor: 555-123-4567, alergia a penicilina";

    const cifrado = cifrador.cifrar(original);

    expect(cifrador.descifrar(cifrado)).toBe(original);
  });

  it("dos cifrados del mismo texto plano producen ciphertexts distintos (IV aleatorio)", () => {
    const cifrador = new CifradorAesGcm(CLAVE_DE_PRUEBA);
    const original = "Mismo texto plano";

    const cifradoUno = cifrador.cifrar(original);
    const cifradoDos = cifrador.cifrar(original);

    expect(cifradoUno).not.toBe(cifradoDos);
    // Ambos deben seguir descifrando al mismo texto original, a pesar de ser
    // ciphertexts distintos.
    expect(cifrador.descifrar(cifradoUno)).toBe(original);
    expect(cifrador.descifrar(cifradoDos)).toBe(original);
  });

  it("manipular el ciphertext antes de descifrar lanza un error (authTag detecta manipulación)", () => {
    const cifrador = new CifradorAesGcm(CLAVE_DE_PRUEBA);
    const cifrado = cifrador.cifrar("dato sensible");

    // Cambia un carácter en medio del base64 (evita los extremos, para no
    // solo invalidar el padding).
    const mitad = Math.floor(cifrado.length / 2);
    const caracterOriginal = cifrado[mitad];
    const caracterAlterado = caracterOriginal === "A" ? "B" : "A";
    const cifradoManipulado =
      cifrado.slice(0, mitad) + caracterAlterado + cifrado.slice(mitad + 1);

    expect(() => cifrador.descifrar(cifradoManipulado)).toThrow();
  });

  it("falla con un error claro si falta CIFRADO_CLAVE (undefined)", () => {
    expect(() => new CifradorAesGcm(undefined)).toThrow(/CIFRADO_CLAVE/);
  });

  it("falla con un error claro si la clave decodifica a un tamaño incorrecto", () => {
    const claveCorta = randomBytes(16).toString("base64"); // 16 bytes, no 32
    expect(() => new CifradorAesGcm(claveCorta)).toThrow(/CIFRADO_CLAVE/);
  });
});
