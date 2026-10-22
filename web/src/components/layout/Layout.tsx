import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from './NavLink';
import { ThemeToggle } from './ThemeToggle';
import { esRutaDashboard } from '../../lib/dashboardTabs';

export function Layout() {
  const { pathname } = useLocation();
  /**
   * El link "Dashboard" del header tiene que quedar iluminado también
   * cuando estás en una de sus tabs (Ingresos, Productos, Compradores):
   * con `end` (coincidencia exacta) solo se activaba en `/`, así que al
   * saltar a una sub-tab el header perdía el resaltado.
   */
  const enDashboard = esRutaDashboard(pathname);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold text-brand-600 dark:text-brand-400">SaleManteiner</h1>
            <span className="hidden text-xs text-gray-400 sm:inline">tracker de ventas</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {/* En pantallas angostas el nav no entra: en vez de empujar la
                página (scroll horizontal de todo el documento), el nav
                scrollea solo. Los links no se encogen (shrink-0). */}
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Principal">
              <NavLink
                to="/"
                end
                viewTransition
                className={({ isActive }: { isActive: boolean }) =>
                  cn({ isActive: isActive || enDashboard })
                }
              >
                Dashboard
              </NavLink>
              <NavLink to="/buys" viewTransition className={cn}>
                Compras
              </NavLink>
              <NavLink to="/solds" viewTransition className={cn}>
                Ventas
              </NavLink>
              <NavLink to="/customers" viewTransition className={cn}>
                Clientes
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
