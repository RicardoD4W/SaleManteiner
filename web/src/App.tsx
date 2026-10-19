import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OverviewTab } from './pages/dashboard/OverviewTab';
import { RevenueTab } from './pages/dashboard/RevenueTab';
import { ProductsTab } from './pages/dashboard/ProductsTab';
import { BuyersTab } from './pages/dashboard/BuyersTab';
import { BuysListPage } from './pages/buys/BuysListPage';
import { BuyEditPage } from './pages/buys/BuyEditPage';
import { SoldsListPage } from './pages/solds/SoldsListPage';
import { SoldEditPage } from './pages/solds/SoldEditPage';

/**
 * Tabs anidadas del Dashboard. Compartidas entre la ruta `/` y la ruta
 * `/dashboard` (S4 del feature dashboard-iteration-1): ambas renderizan
 * `<DashboardPage>` con las mismas children, de modo que `/` y
 * `/dashboard` muestran exactamente la misma vista.
 */
const dashboardChildren: RouteObject[] = [
  { index: true, element: <OverviewTab /> },
  { path: 'revenue', element: <RevenueTab /> },
  { path: 'products', element: <ProductsTab /> },
  { path: 'buyers', element: <BuyersTab /> },
];

/**
 * Router de la app (S10 de feature-buys-and-solds + S3-S4 de
 * dashboard-iteration-1).
 *
 *  - `/`              → Dashboard (mismo componente que `/dashboard`).
 *  - `/dashboard`     → Dashboard (mismo componente que `/`).
 *  - `/dashboard/{revenue,products,buyers}` → tabs con deep-link.
 *  - `/buys`          → lista de compras (el "+ Nueva compra" abre modal).
 *  - `/buys/:id`      → form de edición de compra.
 *  - `/solds`         → lista de ventas (el "+ Nueva venta" abre modal).
 *  - `/solds/:id`     → form de edición de venta.
 *
 *  Las rutas `/buys/new` y `/solds/new` se eliminaron (S3): la creación
 *  se hace en modales (BuyNewModal / SaleNewModal).
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // `/` y `/dashboard` muestran el mismo componente (S4 del feature).
      // Usamos `path: ''` en vez de `index: true` para que el type de
      // react-router v7 (que prohibe `children` en index routes) no se queje.
      // `path: ''` matchea el index de `/` igual que `index: true` lo haría.
      { path: '', element: <DashboardPage />, children: dashboardChildren },
      { path: 'dashboard', element: <DashboardPage />, children: dashboardChildren },
      { path: 'buys', element: <BuysListPage /> },
      { path: 'buys/:id', element: <BuyEditPage /> },
      { path: 'solds', element: <SoldsListPage /> },
      { path: 'solds/:id', element: <SoldEditPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
