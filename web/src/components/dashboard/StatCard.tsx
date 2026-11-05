import { Card, CardBody } from '../ui/Card';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  cardClassName?: string;
}

export function StatCard({ label, value, hint, valueClassName, cardClassName }: StatCardProps) {
  return (
    <Card className={cardClassName}>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p
          className={[
            'mt-1 text-2xl font-semibold tabular-nums',
            valueClassName ?? 'text-gray-900 dark:text-gray-100',
          ].join(' ')}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}
