import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { SalesListPage } from './pages/SalesListPage';
import { SaleNewPage } from './pages/SaleNewPage';
import { SaleEditPage } from './pages/SaleEditPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <SalesListPage /> },
      { path: 'sales/new', element: <SaleNewPage /> },
      { path: 'sales/:id', element: <SaleEditPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
