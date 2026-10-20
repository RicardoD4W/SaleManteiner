/**
 * Estilo compartido de las cabeceras de tabla.
 *
 * Las cuatro tablas de la app (las de `/buys` y `/solds`, y las de las tabs
 * "Productos" y "Compradores" del dashboard) usan las MISMAS cabeceras:
 * mismo padding, mismo peso, sin selección de texto y con feedback de
 * hover. Antes cada una iba por su cuenta y se notaba el salto de `px-3`
 * a `px-4` entre unas y otras.
 *
 * La alineación (izquierda/derecha) y el cursor NO viven aquí: dependen de
 * la columna y de si es ordenable, así que los aplica cada sitio.
 */

/** Padding, tipografía, no-selección y hover de las cabeceras. */
export const tableHeadClass =
  'select-none px-4 py-2 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';
