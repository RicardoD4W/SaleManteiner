import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { SalesListPage } from './pages/SalesListPage';
import { SaleNewPage } from './pages/SaleNewPage';
import { SaleEditPage } from './pages/SaleEditPage';
import { SalesImportPage } from './pages/SalesImportPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OverviewTab } from './pages/dashboard/OverviewTab';
import { RevenueTab } from './pages/dashboard/RevenueTab';
import { ProductsTab } from './pages/dashboard/ProductsTab';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <SalesListPage /> },
      { path: 'sales/new', element: <SaleNewPage /> },
      // `sales/import` va antes de `sales/:id` para que el router no trate
      // "import" como un id.
      { path: 'sales/import', element: <SalesImportPage /> },
      { path: 'sales/:id', element: <SaleEditPage /> },
      // Fase 5 — Dashboard con nested routes. El padre <Outlet/> del
      // DashboardPage renderea la tab activa; las tabs son URLs
      // compartibles (deep-linkable, back-button funciona).
      {
        path: 'dashboard',
        element: <DashboardPage />,
        children: [
          { index: true, element: <OverviewTab /> },
          { path: 'revenue', element: <RevenueTab /> },
          { path: 'products', element: <ProductsTab /> },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
