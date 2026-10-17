import { Link } from 'react-router-dom';
import { KpiCards } from '../components/sales/KpiCards';
import { SalesTable } from '../components/sales/SalesTable';

export function SalesListPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900">Ventas</h2>
        <div className="flex items-center gap-2">
          <Link
            to="/sales/import"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            data-testid="link-import-csv"
          >
            Importar CSV
          </Link>
          <Link
            to="/sales/new"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            + Nueva venta
          </Link>
        </div>
      </div>
      <KpiCards />
      <SalesTable />
    </div>
  );
}
