import { useMemo, useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useSortable } from '../../hooks/useSortable';
import { Spinner } from '../../components/ui/Spinner';
import { errorAlertClass, tableHeadClass } from '../../components/ui/tableStyles';
import { CustomerFormModal } from '../../components/sales/CustomerFormModal';
import { DeleteCustomerDialogs } from '../../components/sales/DeleteCustomerDialogs';
import { formatEuro } from '../../lib/format';
import { round2 } from '../../lib/round';
import type { Customer } from '../../schemas/customers';
import { cn } from '../../lib/classNames';
import { SortableTableHead } from '../../components/ui/SortableTableHead';
import { ErrorState } from '../../components/ui/ErrorState';

interface CustomerRow {
  id: number;
  name: string;
  ventas: number;
  total_gastado: number;

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
        ventas: customer.ventas,
        total_gastado: round2(customer.total_gastado),
        customer,
      })),
    [customers],
  );

  const { sortedItems, sortKey, sortDir, onSort } = useSortable<CustomerRow>(rows);

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

      {sortedItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">No hay clientes todavía.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
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
                <th scope="col" className={`${tableHeadClass} text-left`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {sortedItems.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {row.name}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                    {row.ventas}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                    {formatEuro(row.total_gastado)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(row.customer)}
                        aria-label={`Editar ${row.name}`}
                        className="cursor-pointer text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:focus-visible:ring-offset-gray-900"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(row.customer)}
                        aria-label={`Borrar ${row.name}`}
                        className="cursor-pointer text-sm font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:focus-visible:ring-offset-gray-900"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
