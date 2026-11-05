import { Link, useParams } from 'react-router-dom';
import { useSold } from '../../hooks/useSold';
import { useCustomer } from '../../hooks/useCustomer';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { formatEuro, formatPhone } from '../../lib/format';
import { receiptDate, receiptLines, receiptTotals } from '../../lib/receipt';

export function SoldReceiptPage() {
  const { id } = useParams();
  const soldId = Number(id);
  const { data: sold, isLoading, isError, error } = useSold(soldId);
  const { data: customer } = useCustomer(sold?.customer_id ?? 0);

  if (!Number.isFinite(soldId) || soldId <= 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-700 dark:text-red-400">Id de venta inválido.</p>
        <Link
          to="/solds"
          className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando recibo…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-700 dark:text-red-400">
          No se pudo cargar la venta: {error.message}
        </p>
        <Link
          to="/solds"
          className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  if (!sold) return null;

  const lines = receiptLines(sold.items ?? []);
  const totals = receiptTotals(sold.sale_price, sold.paid_amount);
  const phone = customer?.phone ? formatPhone(customer.phone) : '';
  const address = customer?.address ?? '';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        <Button onClick={() => window.print()}>Imprimir o guardar como PDF</Button>
        <Link to="/solds" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
          ← Volver
        </Link>
      </div>

      <article className="rounded-md border border-gray-200 bg-white p-8 text-gray-900 shadow-sm print:border-0 print:p-0 print:shadow-none dark:border-gray-300 dark:bg-gray-50">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-gray-300">
          <div>
            <h2 className="text-xl font-bold">Recibo de venta</h2>
            <p className="text-sm text-gray-500">Nº {sold.id}</p>
          </div>
          <p className="text-sm text-gray-600">
            Fecha: {receiptDate(sold.sold_at, sold.created_at)}
          </p>
        </header>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</h3>
          <p className="mt-1 font-medium">{sold.customer_name}</p>
          {phone ? <p className="text-sm text-gray-600">{phone}</p> : null}
          {address ? <p className="text-sm whitespace-pre-line text-gray-600">{address}</p> : null}
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Productos</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th scope="col" className="py-1 font-medium">
                  Producto
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-gray-200">
                  <td className="py-1.5">{line.productName}</td>
                  <td className="py-1.5 text-right tabular-nums">{line.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span>Total</span>
            <span className="font-semibold tabular-nums">{formatEuro(totals.total)}</span>
          </div>
          {totals.paid !== null ? (
            <>
              <div className="flex justify-between gap-4 text-gray-600">
                <span>Cobrado</span>
                <span className="tabular-nums">{formatEuro(totals.paid)}</span>
              </div>
              <div className="flex justify-between gap-4 text-gray-600">
                <span>Pendiente</span>
                <span className="tabular-nums">{formatEuro(totals.pending)}</span>
              </div>
            </>
          ) : null}
        </section>
      </article>
    </div>
  );
}
