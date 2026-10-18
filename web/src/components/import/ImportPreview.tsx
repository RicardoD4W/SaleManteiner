import { Badge } from '../ui/Badge';
import type { CreateSaleInput } from '../../schemas/sales';

export interface PreviewRow {
  /** Índice 1-based para mostrar al usuario (`Fila 3`). */
  rowNumber: number;
  /** Si pasó validación Zod. */
  ok: boolean;
  /** Versión parseada y validada (presente si `ok`). */
  parsed?: CreateSaleInput;
  /** Mensaje de error legible (presente si `!ok`). */
  error?: string;
  /** Valor crudo original por si queremos mostrarlo más adelante. */
  raw?: Record<string, string>;
}

interface ImportPreviewProps {
  /** Resultado completo (puede exceder 10 filas). */
  rows: PreviewRow[];
  /** Máximo de filas a mostrar en la tabla (default 10). */
  maxShown?: number;
}

/**
 * Tabla preview de las filas del CSV validadas con `CreateSaleInput.safeParse`.
 * Solo muestra las primeras `maxShown` filas; el resto se resume en un
 * "y N más…". Las filas inválidas se resaltan con badge rojo y muestran la
 * razón al expandirlas (futuro enhancement).
 */
export function ImportPreview({ rows, maxShown = 10 }: ImportPreviewProps) {
  const shown = rows.slice(0, maxShown);
  const hidden = rows.length - shown.length;
  const validCount = rows.filter((r) => r.ok).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-medium text-gray-900">Vista previa</h3>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={invalidCount === 0 ? 'success' : 'danger'}>
            {validCount} válidas
          </Badge>
          {invalidCount > 0 ? (
            <Badge variant="warning">{invalidCount} inválidas</Badge>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">#</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                Producto
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                Coste
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                Precio
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                Vendido
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {shown.map((row) => (
              <tr
                key={row.rowNumber}
                className={row.ok ? '' : 'bg-red-50 dark:bg-red-950/30'}
                data-testid={`preview-row-${row.rowNumber}`}
              >
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.rowNumber}</td>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                  {row.parsed?.product_name ?? row.raw?.['product_name'] ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {row.parsed
                    ? (row.parsed.cost_cents / 100).toFixed(2) + ' €'
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {row.parsed
                    ? (row.parsed.price_cents / 100).toFixed(2) + ' €'
                    : '—'}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {row.parsed ? (row.parsed.sold ? 'Sí' : 'No') : '—'}
                </td>
                <td className="px-3 py-2">
                  {row.ok ? (
                    <Badge variant="success">OK</Badge>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      title={row.error}
                    >
                      Inválida: {row.error}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 ? (
        <p className="text-xs text-gray-500">… y {hidden} filas más.</p>
      ) : null}
    </div>
  );
}
