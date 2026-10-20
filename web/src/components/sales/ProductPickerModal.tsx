/**
 * Modal de selección de productos para crear una venta (S5 del feature).
 *
 * Lista todas las compras con stock disponible (disponibles > 0).
 * Cada fila tiene un checkbox para multi-select.
 * Al confirmar, llama a `onConfirm` con los items seleccionados.
 *
 * Accesibilidad (WCAG 2.2):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
 *  - Focus trap al abrir (primer foco en el modal)
 *  - Cierre con Escape o click fuera
 *  - `aria-selected` en los items del listbox (checkbox, no listbox pattern)
 */
import { useEffect, useRef, useState } from 'react';
import { useBuysStock } from '../../hooks/useBuysStock';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import type { BuyWithStock } from '../../api/buys';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se llama al confirmar con los items seleccionados. */
  onConfirm: (
    items: Array<{ buy_id: number; product_name: string; quantity: number; max: number }>,
  ) => void;
  /**
   * Selección con la que se abre el modal (S1 de feature-modal-venta-ux).
   * Si viene, esos items aparecen tildados y con su cantidad: al reabrir el
   * picker desde "+ Cambiar productos" no se pierde lo que ya estaba elegido.
   *
   * OJO: el padre tiene que memoizarlo, porque el modal reinicia su estado
   * cuando cambia la referencia.
   */
  initialSelection?: Array<{ buy_id: number; quantity: number }>;
}

/** Filtro de texto para buscar por nombre de producto. */
function ProductRow({
  item,
  checked,
  onToggle,
  quantity,
  onQuantityChange,
  disabled,
}: {
  item: BuyWithStock;
  checked: boolean;
  onToggle: (id: number) => void;
  quantity: number;
  onQuantityChange: (id: number, qty: number) => void;
  disabled: boolean;
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3',
        'last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(item.id)}
        className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-brand-400"
        aria-label={`Seleccionar ${item.product_name}`}
      />

      {/* Info del producto */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.product_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{item.disponibles} disponibles</p>
      </div>

      {/* Selector de cantidad (solo si está tildado y max > 1) */}
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
            // Al enfocar se selecciona el contenido: escribir "2" sobre "1"
            // REEMPLAZA en vez de concatenar ("12"). Sin esto hay que
            // seleccionar el texto a mano para cambiar la cantidad.
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
  isOpen,
  onClose,
  onConfirm,
  initialSelection,
}: ProductPickerModalProps) {
  const { data: buysWithStock, isLoading, isError, error, refetch } = useBuysStock();

  /** buy_id → checked */
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  /** buy_id → quantity (solo para los tildados) */
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  /** Filtro de búsqueda por nombre */
  const [filter, setFilter] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Al abrir: se aplica la selección inicial (si viene) o se arranca en vacío.
  useEffect(() => {
    if (isOpen) {
      const nextChecked: Record<number, boolean> = {};
      const nextQuantities: Record<number, number> = {};
      for (const sel of initialSelection ?? []) {
        nextChecked[sel.buy_id] = true;
        nextQuantities[sel.buy_id] = sel.quantity;
      }
      setChecked(nextChecked);
      setQuantities(nextQuantities);
      setFilter('');
      // Enfocar el input de filtro o el botón de cerrar
      requestAnimationFrame(() => {
        (firstFocusRef.current ?? closeButtonRef.current)?.focus();
      });
    }
  }, [isOpen, initialSelection]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Cerrar con click fuera del dialog
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const handleToggle = (id: number) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id]) {
        // Default quantity = 1
        setQuantities((q) => ({ ...q, [id]: 1 }));
      } else {
        // Remove quantity
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
          // Stock disponible: la modal de venta lo usa como tope de la
          // cantidad. Antes se mandaba solo la cantidad y el primer item
          // quedaba "fijado en 1 unidad" (sin input para cambiarla).
          max: buy?.disponibles ?? quantity,
        };
      });
    onConfirm(selected);
  };

  const selectedCount = Object.values(checked).filter(Boolean).length;
  const filteredBuys = (buysWithStock ?? []).filter((b) =>
    b.product_name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={handleBackdropClick}
      aria-hidden={!isOpen}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-picker-title"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Header */}
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

        {/* Búsqueda */}
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

        {/* Lista */}
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
          ) : filteredBuys.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {filter
                ? 'No hay productos que coincidan.'
                : 'No hay productos con stock disponible.'}
            </div>
          ) : (
            <ul>
              {filteredBuys.map((buy) => (
                <li key={buy.id}>
                  <ProductRow
                    item={buy}
                    checked={!!checked[buy.id]}
                    onToggle={handleToggle}
                    quantity={quantities[buy.id] ?? 1}
                    onQuantityChange={handleQuantityChange}
                    disabled={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
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
