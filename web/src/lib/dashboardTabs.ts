export interface DashboardTab {
  to: string;

  label: string;

  end: boolean;
}

export const DASHBOARD_TABS: DashboardTab[] = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/revenue', label: 'Ingresos', end: false },
  { to: '/products', label: 'Productos', end: false },
  { to: '/buyers', label: 'Compradores', end: false },
];

export const DASHBOARD_ROUTES: string[] = DASHBOARD_TABS.map((tab) => tab.to);

export function isDashboardRoute(pathname: string): boolean {
  return DASHBOARD_ROUTES.includes(pathname);
}
