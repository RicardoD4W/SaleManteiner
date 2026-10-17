import { useStats } from '../../hooks/useStats';
import { Card, CardBody } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { formatCents } from '../../lib/format';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}

function StatCard({ label, value, hint, emphasis = false }: StatCardProps) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p
          className={[
            'mt-1 text-2xl font-semibold tabular-nums',
            emphasis ? 'text-brand-600' : 'text-gray-900',
          ].join(' ')}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function KpiCards() {
  const { data, isLoading, isError, error, refetch } = useStats();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Spinner size="sm" /> Cargando estadísticas…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600">
            No se pudieron cargar las estadísticas: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-brand-600 hover:underline"
          >
            Reintentar
          </button>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  const netIsPositive = data.net_profit_cents >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatCard label="Total" value={String(data.total)} hint="ventas registradas" />
      <StatCard
        label="Vendidas"
        value={String(data.sold)}
        hint={`${data.not_sold} pendientes`}
      />
      <StatCard
        label="Ingresos"
        value={formatCents(data.revenue_cents)}
        hint="solo de ventas concretadas"
      />
      <StatCard
        label="Costes"
        value={formatCents(data.cost_cents + data.associated_costs_cents)}
        hint={`${formatCents(data.cost_cents)} producto + ${formatCents(data.associated_costs_cents)} asociados`}
      />
      <StatCard
        label="Beneficio neto"
        value={(netIsPositive ? '+' : '') + formatCents(data.net_profit_cents)}
        hint="revenue − costes"
        emphasis
      />
    </div>
  );
}
