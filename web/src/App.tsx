import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OverviewTab } from './pages/dashboard/OverviewTab';
import { RevenueTab } from './pages/dashboard/RevenueTab';
import { ProductsTab } from './pages/dashboard/ProductsTab';
import { BuyersTab } from './pages/dashboard/BuyersTab';
import { BuysListPage } from './pages/buys/BuysListPage';
import { BuyNewPage } from './pages/buys/BuyNewPage';
import { BuyEditPage } from './pages/buys/BuyEditPage';
import { SoldsListPage } from './pages/solds/SoldsListPage';
import { SoldNewPage } from './pages/solds/SoldNewPage';
import { SoldEditPage } from './pages/solds/SoldEditPage';

/**
 * Router de la app (S10 de feature-buys-and-solds).
 *
 *  - `/`              → Dashboard (con tabs anidadas en `/dashboard/*`).
 *  - `/buys`          → lista de compras.
 *  - `/buys/new`      → form de nueva compra.
 *  - `/buys/:id`      → form de edición de compra.
 *  - `/solds`         → lista de ventas.
 *  - `/solds/new`     → form de nueva venta (con ProductPickerModal).
 *  - `/solds/:id`     → form de edición de venta.
 *  - `/dashboard`     → tab default (Overview) — alias de `/`.
 *  - `/dashboard/{revenue,products,buyers}` → tabs con deep-link.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'dashboard',
        element: <DashboardPage />,
        children: [
          { index: true, element: <OverviewTab /> },
          { path: 'revenue', element: <RevenueTab /> },
          { path: 'products', element: <ProductsTab /> },
          { path: 'buyers', element: <BuyersTab /> },
        ],
      },
      { path: 'buys', element: <BuysListPage /> },
      { path: 'buys/new', element: <BuyNewPage /> },
      { path: 'buys/:id', element: <BuyEditPage /> },
      { path: 'solds', element: <SoldsListPage /> },
      { path: 'solds/new', element: <SoldNewPage /> },
      { path: 'solds/:id', element: <SoldEditPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
