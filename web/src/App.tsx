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
import { CustomersListPage } from './pages/customers/CustomersListPage';

/**
 * Tabs anidadas bajo `/` (raíz). La ruta `/dashboard` se eliminó: el
 * dashboard vive solo en `/` (con sus sub-tabs como rutas top-level).
 */
const dashboardChildren: RouteObject[] = [
  { index: true, element: <OverviewTab /> },
  { path: 'revenue', element: <RevenueTab /> },
  { path: 'products', element: <ProductsTab /> },
  { path: 'buyers', element: <BuyersTab /> },
];

/**
 * Router de la app (S10 de feature-buys-and-solds + S3-S4 de
 * dashboard-iteration-1; simplificado: `/dashboard` → `/`).
 *
 *  - `/`              → Dashboard (Overview por default).
 *  - `/{revenue,products,buyers}` → tabs del dashboard (deep-link).
 *  - `/buys`          → lista de compras (el "+ Nueva compra" abre modal).
 *  - `/buys/:id`      → form de edición de compra.
 *  - `/solds`         → lista de ventas (el "+ Nueva venta" abre modal).
 *  - `/solds/:id`     → form de edición de venta.
 *  - `/customers`     → lista de clientes (el "+ Nuevo cliente" abre modal).
 *
 *  Las rutas `/buys/new` y `/solds/new` se eliminaron (S3): la creación
 *  se hace en modales (BuyNewModal / SaleNewModal).
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // Dashboard en la raíz. `path: ''` matchea el index de `/` (igual que
      // `index: true` pero compatible con `children` en react-router v7).
      { path: '', element: <DashboardPage />, children: dashboardChildren },
      { path: 'buys', element: <BuysListPage /> },
      { path: 'buys/:id', element: <BuyEditPage /> },
      { path: 'solds', element: <SoldsListPage /> },
      { path: 'solds/:id', element: <SoldEditPage /> },
      { path: 'customers', element: <CustomersListPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
