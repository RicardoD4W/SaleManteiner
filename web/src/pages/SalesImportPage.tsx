import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { UploadCSV, type ParsedCsv } from '../components/import/UploadCSV';
import { ImportPreview, type PreviewRow } from '../components/import/ImportPreview';
import { useImportSales } from '../hooks/useImportSales';
import { CreateSaleInput as CreateSaleInputSchema } from '../schemas/sales';
import type { CreateSaleInput } from '../schemas/sales';
import { ApiError } from '../api/client';

const MAX_ROWS_PER_BATCH = 1000;

/**
 * Página /sales/import (Fase 3). Orquesta:
 *  1. UploadCSV: parseo del archivo con papaparse.
 *  2. Validación fila por fila con `CreateSaleInput.safeParse` (mismo schema
 *     que el server → el preview es la verdad).
 *  3. ImportPreview: muestra estado verde/rojo por fila.
 *  4. Botón "Importar N ventas" que envía TODAS las válidas al endpoint
 *     POST /api/sales/import. Decisión S2 (Fase 3): batch atómico, todo-o-nada.
 *     Si el server rechaza (422), NO se inserta nada y mostramos el detalle.
 */
export function SalesImportPage() {
  const navigate = useNavigate();
  const importMutation = useImportSales();

  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Convierte una fila cruda (header → string) al input del schema. */
  function coerceRow(raw: Record<string, string>): Record<string, unknown> {
    const asNumber = (s: string | undefined): number | undefined => {
      if (s == null || s.trim() === '') return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : Number.NaN;
    };
    const asBool = (s: string | undefined): boolean | undefined => {
      if (s == null || s.trim() === '') return undefined;
      const v = s.trim().toLowerCase();
      if (v === 'true' || v === '1' || v === 'sí' || v === 'si') return true;
      if (v === 'false' || v === '0' || v === 'no') return false;
      return undefined;
    };
    const asTrimmed = (s: string | undefined): string | undefined =>
      s == null ? undefined : s.trim() === '' ? undefined : s.trim();
    return {
      product_name: asTrimmed(raw['product_name']) ?? '',
      buyer_name: asTrimmed(raw['buyer_name']),
      cost_cents: asNumber(raw['cost_cents']),
      price_cents: asNumber(raw['price_cents']),
      associated_costs_cents: asNumber(raw['associated_costs_cents']),
      sold: asBool(raw['sold']),
      purchase_date: asTrimmed(raw['purchase_date']),
      sold_at: asTrimmed(raw['sold_at']),
      notes: asTrimmed(raw['notes']),
    };
  }

  const previewRows: PreviewRow[] = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((raw, idx) => {
      const coerced = coerceRow(raw);
      const r = CreateSaleInputSchema.safeParse(coerced);
      if (r.success) {
        return {
          rowNumber: idx + 2, // +2 porque la fila 1 es el header.
          ok: true,
          parsed: r.data,
          raw,
        };
      }
      const firstIssue = r.error.issues[0];
      const reason = firstIssue
        ? `${firstIssue.path.join('.') || 'fila'}: ${firstIssue.message}`
        : 'datos inválidos';
      return { rowNumber: idx + 2, ok: false, error: reason, raw };
    });
  }, [parsed]);

  const validRows: CreateSaleInput[] = useMemo(
    () =>
      previewRows.flatMap((r) => (r.ok && r.parsed ? [r.parsed] : [])),
    [previewRows],
  );
  const invalidCount = previewRows.length - validRows.length;

  function handleParsed(p: ParsedCsv) {
    setError(null);
    setParsed(p);
  }
  function handleCsvError(msg: string) {
    setError(msg);
    setParsed(null);
  }
  function reset() {
    setParsed(null);
    setError(null);
  }

  async function handleImport() {
    if (!parsed || validRows.length === 0) return;
    if (validRows.length > MAX_ROWS_PER_BATCH) {
      setError(
        `El CSV tiene ${validRows.length} filas válidas; el máximo por lote es ${MAX_ROWS_PER_BATCH}. Dividilo en archivos más chicos.`,
      );
      return;
    }
    try {
      const result = await importMutation.mutateAsync(validRows);
      // Redirigir a la home con la lista de ventas ya actualizada.
      navigate('/', {
        state: { toast: `Importaste ${result.imported} ventas.` },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.body.error ?? `Error ${err.status} al importar el CSV.`,
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error desconocido al importar.');
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">
          Importar ventas desde CSV
        </h2>
        <Link to="/" className="text-sm text-gray-500 hover:underline">
          ← Volver
        </Link>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {parsed == null ? (
            <>
              <p className="text-sm text-gray-600">
                Subí un CSV con una fila por venta. Las cabeceras deben llamarse
                igual que los campos del formulario (ver la lista abajo del
                dropzone).
              </p>
              <UploadCSV onParsed={handleParsed} onError={handleCsvError} />
              {error ? (
                <p
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between text-sm text-gray-600">
                <span>
                  Archivo: <strong>{parsed.fileName}</strong> ·{' '}
                  {parsed.rows.length} filas
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="text-brand-600 hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {invalidCount > 0 ? (
                <p
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  Hay {invalidCount} fila(s) inválida(s). Corregí el CSV y volvé
                  a subirlo — el botón de importación queda deshabilitado hasta
                  que todas las filas sean válidas.
                </p>
              ) : null}

              <ImportPreview rows={previewRows} />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/')}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  isLoading={importMutation.isPending}
                  disabled={
                    importMutation.isPending ||
                    validRows.length === 0 ||
                    invalidCount > 0
                  }
                  data-testid="import-submit"
                >
                  {validRows.length === 0
                    ? 'Sin filas válidas'
                    : `Importar ${validRows.length} ventas`}
                </Button>
              </div>

              {error ? (
                <p
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
