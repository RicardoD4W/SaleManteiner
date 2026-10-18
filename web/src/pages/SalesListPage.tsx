import { Link } from 'react-router-dom';
import { KpiCards } from '../components/sales/KpiCards';
import { SalesTable } from '../components/sales/SalesTable';
import { salesApi } from '../api/sales.js';
import { triggerDownload } from '../lib/download';

export function SalesListPage() {
  /**
   * Dispara el download disparando un `<a>` programático que apunta al endpoint.
   * El server responde con `Content-Disposition: attachment; filename=sales-YYYY-MM-DD.csv`,
   * así que el browser dispara el download automáticamente. Si el endpoint devuelve
   * 4xx/5xx, el `<a>` falla silenciosamente (el browser muestra el error en otra
   * pestaña). Para el MVP eso es suficiente; si hace falta UX más amable, podemos
   * convertirlo a `fetch + blob + URL.createObjectURL` con manejo de error propio.
   */
  function handleExportCsv() {
    const filename = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(salesApi.exportUrl, filename);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Ventas</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
            data-testid="button-export-csv"
          >
            Exportar CSV
          </button>
          <Link
            to="/sales/import"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
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
