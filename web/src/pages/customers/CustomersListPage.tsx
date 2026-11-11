import { useMemo, useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useSortable } from '../../hooks/useSortable';
import { useAnimatedRows } from '../../hooks/useAnimatedRows';
import { Spinner } from '../../components/ui/Spinner';
import { errorAlertClass, tableHeadClass } from '../../components/ui/tableStyles';
import { CustomerFormModal } from '../../components/sales/CustomerFormModal';
import { DeleteCustomerDialogs } from '../../components/sales/DeleteCustomerDialogs';
import { formatEuro, formatPhone } from '../../lib/format';
import { round2 } from '../../lib/round';
import type { Customer } from '../../schemas/customers';
import { cn } from '../../lib/classNames';
import { SortableTableHead } from '../../components/ui/SortableTableHead';
import { ErrorState } from '../../components/ui/ErrorState';
import { NotesPopover } from '../../components/ui/NotesPopover';
import { PencilIcon, TrashIcon } from '../../components/ui/icons';

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  ventas: number;
  total_gastado: number;
  deuda: number;

  customer: Customer;
}

export function CustomersListPage() {
  const { data: customers, isLoading, isError, error, refetch } = useCustomers();

  const [editing, setEditing] = useState<Customer | null>(null);

  const [isCreating, setIsCreating] = useState(false);

  const [deleting, setDeleting] = useState<Customer | null>(null);

  const rows = useMemo<CustomerRow[]>(
    () =>
      (customers ?? []).map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone ?? null,
        address: customer.address ?? null,
        notes: customer.notes ?? null,
        ventas: customer.ventas,
        total_gastado: round2(customer.total_gastado),
        deuda: round2(customer.deuda),
        customer,
      })),
    [customers],
  );

  const { sortedItems, sortKey, sortDir, onSort } = useSortable<CustomerRow>(rows);

  const { rows: animatedRows, rowClassName, rowKey } = useAnimatedRows(sortedItems, '', 'slide');

  const closeModals = () => {
    setIsCreating(false);
    setEditing(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando clientes…
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn(errorAlertClass, 'p-4')}>
        <ErrorState
          message={`No se pudieron cargar los clientes: ${error.message}`}
          onRetry={() => refetch()}
          messageClassName=""
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Clientes</h2>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
        >
          + Nuevo cliente
        </button>
      </div>

      {animatedRows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">No hay clientes todavía.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <SortableTableHead<CustomerRow>
                    label="Cliente"
                    sortKey="name"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                  <th scope="col" className={`${tableHeadClass} text-left`}>
                    Teléfono
                  </th>
                  <th scope="col" className={`${tableHeadClass} text-left`}>
                    Dirección
                  </th>
                  <SortableTableHead<CustomerRow>
                    label="Ventas"
                    sortKey="ventas"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                  <SortableTableHead<CustomerRow>
                    label="Total gastado"
                    sortKey="total_gastado"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                  <SortableTableHead<CustomerRow>
                    label="Deuda"
                    sortKey="deuda"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                  <th scope="col" className={`${tableHeadClass} text-center`}>
                    Notas
                  </th>
                  <th scope="col" className={`${tableHeadClass} text-left`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {animatedRows.map((row) => (
                  <tr
                    key={rowKey(row.id)}
                    className={cn('hover:bg-gray-50 dark:hover:bg-gray-800', rowClassName(row.id))}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {row.name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
                      {formatPhone(row.phone) || '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {row.address || '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                      {row.ventas}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                      {formatEuro(row.total_gastado)}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                      {formatEuro(row.deuda)}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                      <NotesPopover notes={row.notes} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing(row.customer)}
                          aria-label={`Editar ${row.name}`}
                          className="cursor-pointer rounded text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-gray-900"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(row.customer)}
                          aria-label={`Borrar ${row.name}`}
                          className="cursor-pointer rounded text-red-700 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:hover:text-red-300 dark:focus-visible:ring-offset-gray-900"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            {sortedItems.length === 1 ? '1 cliente' : `${sortedItems.length} clientes`}
          </div>
        </div>
      )}

      {isCreating ? <CustomerFormModal mode="create" onClose={closeModals} /> : null}
      {editing ? <CustomerFormModal mode="edit" customer={editing} onClose={closeModals} /> : null}

      <DeleteCustomerDialogs customer={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
