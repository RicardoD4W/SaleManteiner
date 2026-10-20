import { Toaster } from 'sileo';
import { useDomTheme } from '../../hooks/useDomTheme';

/**
 * `<Toaster>` de sileo: el punto de entrada de los avisos de la app.
 *
 * Se monta una sola vez, en la raíz (fuera del router), para que los toasts
 * sobrevivan a la navegación. El tema se lee del DOM (`useDomTheme`) para
 * que el fondo y el texto del toast sigan al toggle de dark mode.
 *
 * Spec: `odd/tasks/feature-toasts-sileo.md` (S1, S2).
 */
export function AppToaster() {
  const theme = useDomTheme();
  return (
    <Toaster
      // OJO: sileo nombra el tema al revés de lo habitual. Su THEME_FILLS es
      // { light: '#1a1a1a' (tarjeta oscura), dark: '#f2f2f2' (tarjeta clara) }
      // y el color del texto sigue al tema: con "light" la descripción sale
      // blanca, con "dark" sale oscura. Para que el toast se parezca a la app
      // hay que invertir: en dark mode usamos el tema "light" de sileo.
      theme={theme === 'dark' ? 'light' : 'dark'}
      position="top-right"
      // Por debajo del header: en top-right tapaba el nav.
      offset={{ top: '4rem' }}
    />
  );
}
