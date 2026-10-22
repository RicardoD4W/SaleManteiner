/**
 * Rutas (y labels) de las tabs del dashboard.
 *
 * El dashboard vive en la raíz `/` y sus tabs son rutas top-level
 * (`/revenue`, `/products`, `/buyers`) — ver `App.tsx`.
 *
 * Esta tabla es la fuente única de esa estructura: la usan el nav de tabs
 * (`DashboardPage`) y el link "Dashboard" del header (`Layout`), que tiene
 * que seguir iluminado cuando estás en una sub-tab (si no, al saltar a
 * "Ingresos" el header perdía el resaltado y parecía que estabas fuera del
 * dashboard).
 */

export interface DashboardTab {
  /** Ruta de la tab. */
  to: string;
  /** Texto visible de la tab. */
  label: string;
  /** Coincidencia exacta (la raíz es prefijo de todas las rutas). */
  end: boolean;
}

export const DASHBOARD_TABS: DashboardTab[] = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/revenue', label: 'Ingresos', end: false },
  { to: '/products', label: 'Productos', end: false },
  { to: '/buyers', label: 'Compradores', end: false },
];

/** Rutas que forman parte del dashboard (la raíz y sus tabs). */
export const DASHBOARD_ROUTES: string[] = DASHBOARD_TABS.map((tab) => tab.to);

/**
 * ¿La ruta actual es el dashboard (raíz) o una de sus tabs?
 *
 * Se usa en el header para que el link "Dashboard" quede resaltado en
 * `/`, `/revenue`, `/products` y `/buyers`.
 */
export function esRutaDashboard(pathname: string): boolean {
  return DASHBOARD_ROUTES.includes(pathname);
}
