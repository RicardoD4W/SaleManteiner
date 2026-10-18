import { Link } from 'react-router-dom';
import { SaleForm } from '../components/sales/SaleForm';
import { Card, CardBody } from '../components/ui/Card';

export function SaleNewPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Nueva venta</h2>
        <Link to="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
          ← Volver
        </Link>
      </div>
      <Card>
        <CardBody>
          <SaleForm />
        </CardBody>
      </Card>
    </div>
  );
}
