import { useMemo, type CSSProperties } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { formatEuro } from '../../lib/format';
import { round2 } from '../../lib/round';
import type { BuyFormInput, BuyFormOutput } from '../../schemas/forms';

interface BuyLotTotalProps {
  control: Control<BuyFormInput, unknown, BuyFormOutput>;
  className?: string;
  valueClassName?: string;
  style?: CSSProperties;
}

export function BuyLotTotal({ control, className, valueClassName, style }: BuyLotTotalProps) {
  const precioUnitario = useWatch({ control, name: 'purchase_cost' });
  const cantidad = useWatch({ control, name: 'quantity' });

  const total = useMemo(() => {
    const precio = Number(precioUnitario);
    const unidades = Number(cantidad);
    if (!Number.isFinite(precio) || !Number.isFinite(unidades)) return null;
    return round2(precio * unidades);
  }, [precioUnitario, cantidad]);

  return (
    <p className={className ?? 'text-sm text-gray-600 dark:text-gray-400'}>
      Total del lote:{' '}
      <span
        className={valueClassName ?? 'font-medium tabular-nums text-gray-800 dark:text-gray-200'}
        style={style}
      >
        {total === null ? '—' : formatEuro(total)}
      </span>
    </p>
  );
}
