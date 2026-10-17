import { NavLink, Outlet } from 'react-router-dom';

/**
 * Layout del Dashboard (Fase 5 / S1).
 *
 * Es la ruta padre de las 3 tabs anidadas via React Router:
 *   /dashboard             → Overview (index)
 *   /dashboard/revenue     → RevenueTab
 *   /dashboard/products    → ProductsTab
 *
 * NavLink con className como función (`isActive`) para highlighting
 * automático según la URL — sin estado local para la tab activa.
 */
const TABS = [
  { to: '/dashboard', label: 'Resumen', end: true },
  { to: '/dashboard/revenue', label: 'Ingresos', end: false },
  { to: '/dashboard/products', label: 'Productos', end: false },
];

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>

      <nav className="border-b border-gray-200" aria-label="Tabs del dashboard">
        <ul className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }: { isActive: boolean }) =>
                  [
                    'inline-block border-b-2 px-1 pb-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
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
