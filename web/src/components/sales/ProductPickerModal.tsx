import { useEffect, useMemo, useRef, useState } from 'react';
import { useBuysStock } from '../../hooks/useBuysStock';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import type { BuyWithStock } from '../../api/buys';

interface ProductPickerModalProps {
  onClose: () => void;

  onConfirm: (
    items: Array<{ buy_id: number; product_name: string; quantity: number; max: number }>,
  ) => void;

  initialSelection?: Array<{ buy_id: number; quantity: number }>;
}

function ProductRow({
  item,
  checked,
  onToggle,
  quantity,
  onQuantityChange,
}: {
  item: BuyWithStock;
  checked: boolean;
  onToggle: (id: number) => void;
  quantity: number;
  onQuantityChange: (id: number, qty: number) => void;
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3',
        'last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-brand-400"
        aria-label={`Seleccionar ${item.product_name}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{item.disponibles} disponibles</p>
      </div>

      {checked && item.disponibles > 1 && (
        <div className="flex shrink-0 items-center gap-1">
          <label htmlFor={`qty-${item.id}`} className="sr-only">
            Cantidad para {item.product_name}
          </label>
          <input
            id={`qty-${item.id}`}
            type="number"
            min={1}
            max={item.disponibles}
            value={quantity}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) =>
              onQuantityChange(
                item.id,
                Math.min(item.disponibles, Math.max(1, Number(e.target.value))),
              )
            }
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      )}
    </label>
  );
}

export function ProductPickerModal({
  onClose,
  onConfirm,
  initialSelection,
}: ProductPickerModalProps) {
  const { data: buysWithStock, isLoading, isError, error, refetch } = useBuysStock();

  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const initiallySelectedIds = useMemo(
    () => new Set((initialSelection ?? []).map((sel) => sel.buy_id)),
    [initialSelection],
  );

  const [filter, setFilter] = useState('');

  const sortedBuys = useMemo(() => {
    const filtered = (buysWithStock ?? []).filter((b) =>
      b.product_name.toLowerCase().includes(filter.toLowerCase()),
    );
    if (initiallySelectedIds.size === 0) return filtered;
    return [...filtered].sort(
      (a, b) => Number(initiallySelectedIds.has(b.id)) - Number(initiallySelectedIds.has(a.id)),
    );
  }, [buysWithStock, filter, initiallySelectedIds]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const nextChecked: Record<number, boolean> = {};
    const nextQuantities: Record<number, number> = {};
    for (const sel of initialSelection ?? []) {
      nextChecked[sel.buy_id] = true;
      nextQuantities[sel.buy_id] = sel.quantity;
    }
    setChecked(nextChecked);
    setQuantities(nextQuantities);
    setFilter('');
    requestAnimationFrame(() => {
      (firstFocusRef.current ?? closeButtonRef.current)?.focus();
    });
  }, [initialSelection]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleToggle = (id: number) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id]) {
        setQuantities((q) => ({ ...q, [id]: 1 }));
      } else {
        setQuantities((q) => {
          const { [id]: _removed, ...rest } = q;
          void _removed;
          return rest;
        });
      }
      return next;
    });
  };

  const handleQuantityChange = (id: number, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: qty }));
  };

  const handleConfirm = () => {
    const buys = buysWithStock ?? [];
    const selected: Array<{
      buy_id: number;
      product_name: string;
      quantity: number;
      max: number;
    }> = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([buy_id, _v]) => {
        void _v;
        const id = Number(buy_id);
        const buy = buys.find((b) => b.id === id);
        const quantity = quantities[id] ?? 1;
        return {
          buy_id: id,
          product_name: buy?.product_name ?? `Producto #${id}`,
          quantity,
          max: buy?.disponibles ?? quantity,
        };
      });
    onConfirm(selected);
  };

  const selectedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-picker-title"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2
            id="product-picker-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            Seleccionar productos
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-800">
          <input
            ref={firstFocusRef}
            type="search"
            placeholder="Buscar producto…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-brand-400 dark:focus:ring-brand-900"
            aria-label="Buscar producto"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-3 px-4 py-8 text-sm text-gray-500">
              <Spinner size="sm" /> Cargando productos…
            </div>
          ) : isError ? (
            <div className="px-4 py-6">
              <p className="text-sm text-red-700 dark:text-red-400">
                No se pudieron cargar los productos: {error.message}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Reintentar
              </button>
            </div>
          ) : sortedBuys.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {filter
                ? 'No hay productos que coincidan.'
                : 'No hay productos con stock disponible.'}
            </div>
          ) : (
            <ul>
              {sortedBuys.map((buy) => (
                <li key={buy.id}>
                  <ProductRow
                    item={buy}
                    checked={!!checked[buy.id]}
                    onToggle={handleToggle}
                    quantity={quantities[buy.id] ?? 1}
                    onQuantityChange={handleQuantityChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedCount > 0
              ? `${selectedCount} seleccionado${selectedCount !== 1 ? 's' : ''}`
              : 'Seleccioná productos para la venta'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={selectedCount === 0}>
              Confirmar ({selectedCount})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
