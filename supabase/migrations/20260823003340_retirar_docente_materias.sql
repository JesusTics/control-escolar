-- Retira `public.docente_materias` por completo: su propósito (asignar a un
-- docente qué puede calificar) queda reemplazado por `grupos.docente_id`
-- (ver 20260823003328_grupos_e_inscripciones.sql y
-- 20260823003332_calificaciones_por_grupo.sql), que es más fino — un docente
-- se asigna directamente a un grupo concreto, no a una materia en general.
-- `cascade` arrastra las políticas de la propia tabla; no hay otras tablas
-- que referencien `docente_materias`.

drop table public.docente_materias cascade;
