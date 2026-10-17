import { Link, useParams } from 'react-router-dom';
import { useSale } from '../hooks/useSale';
import { SaleForm } from '../components/sales/SaleForm';
import { DeleteSaleButton } from '../components/sales/DeleteSaleButton';
import { Card, CardBody } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { formatCents, formatDate, formatDateTime } from '../lib/format';

export function SaleEditPage() {
  const { id } = useParams();
  const saleId = Number(id);
  const { data: sale, isLoading, isError, error } = useSale(saleId);

  if (!Number.isFinite(saleId) || saleId <= 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600">Id de venta inválido.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          ← Volver
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Spinner size="sm" /> Cargando venta…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600">No se pudo cargar la venta: {error.message}</p>
        <Link to="/" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          ← Volver
        </Link>
      </div>
    );
  }

  if (!sale) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Editar venta</h2>
        <Link to="/" className="text-sm text-gray-500 hover:underline">
          ← Volver
        </Link>
      </div>

      <Card>
        <CardBody className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Beneficio neto (con este precio):</span>
            <span
              className={
                sale.price_cents - sale.cost_cents - sale.associated_costs_cents >= 0
                  ? 'font-semibold text-brand-600'
                  : 'font-semibold text-red-600'
              }
            >
              {formatCents(sale.price_cents - sale.cost_cents - sale.associated_costs_cents)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Registrada el {formatDateTime(sale.created_at)}</span>
            {sale.sold_at ? <span>· Vendida el {formatDate(sale.sold_at)}</span> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SaleForm sale={sale} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <DeleteSaleButton id={sale.id} productName={sale.product_name} />
        </CardBody>
      </Card>
    </div>
  );
}
