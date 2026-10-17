import { NavLink, Outlet } from 'react-router-dom';
import { cn } from './NavLink';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold text-brand-600">SaleManteiner</h1>
            <span className="hidden text-xs text-gray-400 sm:inline">
              tracker de ventas
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={cn}>
              Ventas
            </NavLink>
            <NavLink to="/sales/new" className={cn}>
              + Nueva
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
