import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useBuysStock } from '../../hooks/useBuysStock';
import { useAnimatedClose } from '../../hooks/useExitAnimation';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { ErrorState } from '../ui/ErrorState';
import { highlightMatch, normalizeText } from '../../lib/searchQuery.js';
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
  index,
  checked,
  onToggle,
  quantity,
  onQuantityChange,
  filter,
  isActive,
  onActivate,
  registerCheckbox,
}: {
  item: BuyWithStock;
  index: number;
  checked: boolean;
  onToggle: (id: number) => void;
  quantity: number;
  onQuantityChange: (id: number, qty: number) => void;
  filter: string;
  isActive: boolean;
  onActivate: (index: number) => void;
  registerCheckbox: (id: number, element: HTMLInputElement | null) => void;
}) {
  const segments = highlightMatch(item.product_name, filter);

  return (
    <label
      className={[
        'flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3',
        'last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800',
        isActive ? 'bg-brand-50 dark:bg-brand-900/20' : '',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onToggle(item.id);
          }
        }}
        onFocus={() => onActivate(index)}
        ref={(element) => registerCheckbox(item.id, element)}
        className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-brand-400"
        aria-label={`Seleccionar ${item.product_name}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {segments.map((segment, index) =>
            segment.match ? (
              <mark
                key={index}
                className="rounded bg-yellow-200 px-0.5 text-gray-900 dark:bg-yellow-500/30 dark:text-gray-100"
              >
                {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
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
  const { closing, close } = useAnimatedClose(onClose);
  const { data: buysWithStock, isLoading, isError, error, refetch } = useBuysStock();

  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const initiallySelectedIds = useMemo(
    () => new Set((initialSelection ?? []).map((sel) => sel.buy_id)),
    [initialSelection],
  );

  const [filter, setFilter] = useState('');

  const [activeIndex, setActiveIndex] = useState(-1);

  const checkboxRefs = useRef(new Map<number, HTMLInputElement>());

  const registerCheckbox = (id: number, element: HTMLInputElement | null) => {
    if (element) checkboxRefs.current.set(id, element);
    else checkboxRefs.current.delete(id);
  };

  const sortedBuys = useMemo(() => {
    const filtered = (buysWithStock ?? []).filter((b) =>
      normalizeText(b.product_name).includes(normalizeText(filter.trim())),
    );
    if (initiallySelectedIds.size === 0) return filtered;
    return [...filtered].sort(
      (a, b) => Number(initiallySelectedIds.has(b.id)) - Number(initiallySelectedIds.has(a.id)),
    );
  }, [buysWithStock, filter, initiallySelectedIds]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filter, sortedBuys.length]);

  const moveActive = (delta: number) => {
    if (sortedBuys.length === 0) return;
    const base = activeIndex < 0 ? (delta > 0 ? 0 : sortedBuys.length - 1) : activeIndex + delta;
    const next = Math.min(Math.max(base, 0), sortedBuys.length - 1);
    setActiveIndex(next);
    const target = sortedBuys[next];
    if (target) checkboxRefs.current.get(target.id)?.focus();
  };

  const handleListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    }
  };

  const firstFocusRef = useRef<HTMLInputElement>(null);

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
  }, [initialSelection]);

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
    <Modal
      title="Seleccionar productos"
      onClose={close}
      exiting={closing}
      size="panel"
      initialFocusRef={firstFocusRef}
      footer={
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedCount > 0
              ? `${selectedCount} seleccionado${selectedCount !== 1 ? 's' : ''}`
              : 'Seleccioná productos para la venta'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={selectedCount === 0}>
              Confirmar ({selectedCount})
            </Button>
          </div>
        </div>
      }
    >
      <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <input
          ref={firstFocusRef}
          type="search"
          placeholder="Buscar producto…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              moveActive(1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              moveActive(-1);
            }
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-brand-400 dark:focus:ring-brand-900"
          aria-label="Buscar producto"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-3 px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
            <Spinner size="sm" /> Cargando productos…
          </div>
        ) : isError ? (
          <div className="px-4 py-6">
            <ErrorState
              message={`No se pudieron cargar los productos: ${error.message}`}
              onRetry={() => refetch()}
            />
          </div>
        ) : sortedBuys.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {filter ? 'No hay productos que coincidan.' : 'No hay productos con stock disponible.'}
          </div>
        ) : (
          <ul onKeyDown={handleListKeyDown}>
            {sortedBuys.map((buy, index) => (
              <li key={buy.id}>
                <ProductRow
                  item={buy}
                  index={index}
                  checked={!!checked[buy.id]}
                  onToggle={handleToggle}
                  quantity={quantities[buy.id] ?? 1}
                  onQuantityChange={handleQuantityChange}
                  filter={filter}
                  isActive={index === activeIndex}
                  onActivate={setActiveIndex}
                  registerCheckbox={registerCheckbox}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
