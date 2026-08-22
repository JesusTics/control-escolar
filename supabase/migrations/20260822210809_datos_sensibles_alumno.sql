-- Primer conjunto mínimo de campos sensibles del expediente de alumno
-- (contacto de tutor y datos médicos), bloqueado hasta ahora por CLAUDE.md
-- 4.4 ("cifrado en reposo para campos sensibles... más allá de lo que da por
-- default la infraestructura") — ver src/lib/cifrado/ para el mecanismo.
--
-- Las tres columnas almacenan el CIPHERTEXT (cifrado en la capa de
-- aplicación con AES-256-GCM, src/lib/cifrado/cifrador-aes-gcm.ts), nunca el
-- dato en claro — por eso basta `text` nullable para cada una, sin importar
-- el largo real del dato original.
--
-- Sin política RLS nueva: heredan las políticas de SELECT/UPDATE existentes
-- de `public.alumnos` (`alumnos_select_propio_o_staff`,
-- `alumnos_update_staff_mismo_plantel`) porque son columnas de la misma
-- tabla, no una tabla nueva. La restricción adicional de que SOLO
-- `administrativo`/`oficina_central` puedan leer estos campos en claro (ni
-- siquiera `docente`, que sí puede ver el resto de la fila por RLS) se
-- aplica en la capa de aplicación, no aquí — ver
-- `src/modules/alumnos/casos-uso/obtener-kardex-alumno.ts`.
alter table public.alumnos
  add column tutor_nombre_cifrado text,
  add column tutor_telefono_cifrado text,
  add column informacion_medica_cifrada text;
