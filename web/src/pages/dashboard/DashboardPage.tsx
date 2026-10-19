import { NavLink, Outlet } from 'react-router-dom';

/**
 * Layout del Dashboard (Fase 5 / S1).
 *
 * Es la ruta padre de las 4 tabs anidadas via React Router bajo `/`
 * (la ruta `/dashboard` se eliminó: el dashboard vive solo en `/`):
 *   /             → Overview (index)
 *   /revenue      → RevenueTab
 *   /products     → ProductsTab
 *   /buyers       → BuyersTab
 *
 * NavLink con className como función (`isActive`) para highlighting
 * automático según la URL — sin estado local para la tab activa.
 */
const TABS = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/revenue', label: 'Ingresos', end: false },
  { to: '/products', label: 'Productos', end: false },
  { to: '/buyers', label: 'Compradores', end: false },
];

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h2>

      <nav className="border-b border-gray-200" aria-label="Tabs del dashboard">
        <ul className="-mb-px flex">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                viewTransition
                className={({ isActive }: { isActive: boolean }) =>
                  [
                    'inline-block border-b-2 px-8 pb-2  text-sm font-medium transition-colors',
                    isActive
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200',
                  ].join(' ')
                }
                data-testid={`dashboard-tab-${tab.label.toLowerCase()}`}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}
