// Puerto (interfaz) del bounded context transversal de Cifrado.
//
// Se aplica hexagonal ligero aquí de forma explícita (CLAUDE.md 4.1): hay
// una decisión de proveedor/algoritmo real (AES-256-GCM vía el módulo
// `crypto` nativo de Node hoy) que podría cambiar en el futuro (ej. mover la
// clave a un KMS gestionado), y la lógica de cifrado no es CRUD trivial —
// es la pieza que protege campos sensibles de LFPDPPP (CLAUDE.md 4.4).
//
// Vive en `src/lib/cifrado/` (no dentro de un módulo de negocio como
// `src/modules/alumnos/`) porque es infraestructura transversal: cualquier
// bounded context futuro con campos sensibles (ej. datos de contacto en
// Comunicación) puede reutilizarla sin depender de Alumnos.
export interface ICifrador {
  /** Cifra un texto plano y devuelve el texto cifrado listo para almacenar. */
  cifrar(textoPlano: string): string;
  /** Descifra un texto previamente cifrado con `cifrar`. Lanza si el
   * texto fue manipulado (falla la verificación del authTag) o el formato
   * es inválido. */
  descifrar(cifrado: string): string;
}
