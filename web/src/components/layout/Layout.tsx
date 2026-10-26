import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { navLinkClass } from '../ui/tableStyles';
import { ThemeToggle } from './ThemeToggle';
import { AppVersion } from './AppVersion';
import { isDashboardRoute } from '../../lib/dashboardTabs';

export function Layout() {
  const { pathname } = useLocation();

  const enDashboard = isDashboardRoute(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold text-brand-600 dark:text-brand-400">SaleManteiner</h1>
            <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">
              tracker de ventas
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Principal">
              <NavLink
                to="/"
                end
                viewTransition
                className={({ isActive }: { isActive: boolean }) =>
                  navLinkClass({ isActive: isActive || enDashboard })
                }
              >
                Dashboard
              </NavLink>
              <NavLink to="/buys" viewTransition className={navLinkClass}>
                Compras
              </NavLink>
              <NavLink to="/solds" viewTransition className={navLinkClass}>
                Ventas
              </NavLink>
              <NavLink to="/customers" viewTransition className={navLinkClass}>
                Clientes
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <AppVersion />
    </div>
  );
}
