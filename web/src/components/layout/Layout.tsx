import { NavLink, Outlet } from 'react-router-dom';
import { cn } from './NavLink';
import { ThemeToggle } from './ThemeToggle';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold text-brand-600 dark:text-brand-400">SaleManteiner</h1>
            <span className="hidden text-xs text-gray-400 sm:inline">
              tracker de ventas
            </span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1" aria-label="Principal">
              <NavLink to="/" end className={cn}>
                Dashboard
              </NavLink>
              <NavLink to="/buys" className={cn}>
                Compras
              </NavLink>
              <NavLink to="/solds" className={cn}>
                Ventas
              </NavLink>
              <NavLink to="/solds/new" className={cn}>
                + Nueva
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
