import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OverviewTab } from './pages/dashboard/OverviewTab';
import { RevenueTab } from './pages/dashboard/RevenueTab';
import { ProductsTab } from './pages/dashboard/ProductsTab';
import { BuyersTab } from './pages/dashboard/BuyersTab';
import { MetricsTab } from './pages/dashboard/MetricsTab';
import { BuysListPage } from './pages/buys/BuysListPage';
import { BuyEditPage } from './pages/buys/BuyEditPage';
import { SoldsListPage } from './pages/solds/SoldsListPage';
import { SoldEditPage } from './pages/solds/SoldEditPage';
import { SoldReceiptPage } from './pages/solds/SoldReceiptPage';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { ExpensesListPage } from './pages/expenses/ExpensesListPage';

const dashboardChildren: RouteObject[] = [
  { index: true, element: <OverviewTab /> },
  { path: 'revenue', element: <RevenueTab /> },
  { path: 'products', element: <ProductsTab /> },
  { path: 'buyers', element: <BuyersTab /> },
  { path: 'metrics', element: <MetricsTab /> },
];

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { path: '', element: <DashboardPage />, children: dashboardChildren },
      { path: 'buys', element: <BuysListPage /> },
      { path: 'buys/:id', element: <BuyEditPage /> },
      { path: 'solds', element: <SoldsListPage /> },
      { path: 'solds/:id', element: <SoldEditPage /> },
      { path: 'solds/:id/receipt', element: <SoldReceiptPage /> },
      { path: 'customers', element: <CustomersListPage /> },
      { path: 'expenses', element: <ExpensesListPage /> },
      { path: 'gastos', element: <Navigate to="/expenses" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
